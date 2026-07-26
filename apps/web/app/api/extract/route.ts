import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { extractReceipt } from "@rr/extraction";
import { convertMinor, parseMoneyToMinor } from "@rr/shared";
import { getFxRate } from "../../../lib/fxRates";

/**
 * Server-side extraction endpoint. OPENAI_API_KEY never reaches a client bundle
 * (mobile or web) — see OCR_PLAN.md §9 — so mobile/web upload the photo here
 * instead of calling OpenAI directly.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Required — without this, a public deployment of this route would let
  // anyone burn OpenAI spend with no account at all. The token is the
  // caller's own Supabase access token (getSession().access_token), same
  // one already used for every other authenticated call in the app.
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Request-scoped — deliberately not @rr/api's singleton client (bound to
  // whichever client was last registered at import time; reusing it here
  // would race across concurrent requests in the same server process) and
  // not lib/fxRates.ts's service-role client (that exists to bypass RLS for
  // a table with no user-facing policy; this one must respect RLS, scoped
  // to the caller's own identity, not bypass it).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } },
  );

  // getUser() re-validates the JWT against the auth server, unlike reading a
  // local session — the right check for a token a client just handed you.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  const { data: membership, error: membershipErr } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .single();
  if (membershipErr || !membership) {
    return NextResponse.json({ error: "No workspace found for this account" }, { status: 403 });
  }
  const workspaceId = (membership as { workspace_id: string }).workspace_id;

  const [{ data: workspace }, { data: categoryRows }] = await Promise.all([
    supabase.from("workspaces").select("home_currency").eq("id", workspaceId).single(),
    supabase.from("categories").select("name").eq("workspace_id", workspaceId).is("archived_at", null).order("sort_order"),
  ]);
  const homeCurrency = (workspace as { home_currency: string } | null)?.home_currency ?? "EUR";
  const categories = ((categoryRows as { name: string }[] | null) ?? []).map((c) => c.name);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'image' field" }, { status: 400 });
  }

  const image = Buffer.from(await file.arrayBuffer());

  try {
    const outcome = await extractReceipt({
      image,
      mimeType: file.type || "image/jpeg",
      categories,
      homeCurrency,
    });

    const d = outcome.result.data;

    // validate.ts treats a poor-legibility or not-a-receipt photo as a hard
    // failure that's not worth escalating to a stronger (pricier) model — no
    // second call fixes a blurry photo. That already saves the extra spend;
    // this surfaces the same signal to the client so it can tell the user to
    // retake the photo instead of silently dumping them into a blank manual
    // entry form with no explanation.
    const retakeIssue = outcome.validation.issues.find(
      (i) => i.field === "legibility" || i.field === "is_receipt",
    );
    if (retakeIssue) {
      return NextResponse.json({ retake: true, reason: retakeIssue.message });
    }

    // Extraction returns decimal strings in whatever currency it read off the
    // receipt (flagged as a soft validation issue in validate.ts when it
    // differs from home). Converted below using the ECB rate for the
    // RECEIPT'S OWN DATE (not scan time) — a card issuer's real conversion
    // happens on the purchase date, so that's the rate this should track,
    // frozen on the receipt via fxRate/fxRateDate so it never drifts on
    // re-read, per DESIGN_V2_DELTA.md §4.1.
    const receiptCurrency = d.currency ?? homeCurrency;
    const receiptDateForFx = d.receipt_date ?? new Date().toISOString().slice(0, 10);
    let totalMinor = parseMoneyToMinor(d.total, receiptCurrency) ?? 0;
    let taxMinor = parseMoneyToMinor(d.tax, receiptCurrency) ?? 0;
    let originalCurrency: string | null = null;
    let originalTotalMinor: number | null = null;
    let fxRate: number | null = null;
    let fxRateDate: string | null = null;

    if (receiptCurrency !== homeCurrency) {
      const fx = await getFxRate(receiptCurrency, homeCurrency, receiptDateForFx);
      if (fx) {
        originalCurrency = receiptCurrency;
        originalTotalMinor = totalMinor;
        fxRate = fx.rate;
        fxRateDate = fx.rateDate;
        totalMinor = convertMinor(totalMinor, receiptCurrency, homeCurrency, fx.rate);
        taxMinor = convertMinor(taxMinor, receiptCurrency, homeCurrency, fx.rate);
      }
      // fx === null (unsupported currency or feed unreachable): fall back to
      // the amounts as extracted, unconverted — no fabricated rate.
    }

    return NextResponse.json({
      retake: false,
      vendor: d.vendor,
      date: d.receipt_date,
      totalMinor,
      taxMinor,
      originalCurrency,
      originalTotalMinor,
      fxRate,
      fxRateDate,
      country: d.country,
      paymentBrand: d.payment_brand,
      paymentLast4: d.payment_last4,
      category: d.category,
      status: outcome.status,
      confidence: outcome.overallConfidence,
      issues: outcome.validation.issues,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
