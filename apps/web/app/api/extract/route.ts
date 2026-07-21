import { NextRequest, NextResponse } from "next/server";
import { extractReceipt } from "@rr/extraction";
import { SEED_CATEGORIES, parseMoneyToMinor } from "@rr/shared";

/**
 * Server-side extraction endpoint. OPENAI_API_KEY never reaches a client bundle
 * (mobile or web) — see OCR_PLAN.md §9 — so the mobile capture flow uploads the
 * photo here instead of calling OpenAI directly.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
  // Stopgap until the next step (authenticating this route with the caller's
  // real session): lib/data.ts's getHomeCurrency()/listCategories() now hit
  // the real Supabase-backed workspace and require an authenticated client
  // this route doesn't have yet — resolving "which workspace" needs the
  // caller's identity, which isn't wired through here yet either. Falls back
  // to a fixed default and the seed category list rather than being broken
  // outright in the meantime.
  const homeCurrency = "EUR";
  const categories = SEED_CATEGORIES as unknown as string[];

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
    // receipt. No FX conversion happens here — a foreign-currency receipt is
    // already flagged as a soft validation issue (see validate.ts) and needs a
    // human to confirm the rate, same as everywhere else in the app.
    const currency = d.currency ?? homeCurrency;

    return NextResponse.json({
      retake: false,
      vendor: d.vendor,
      date: d.receipt_date,
      totalMinor: parseMoneyToMinor(d.total, currency) ?? 0,
      taxMinor: parseMoneyToMinor(d.tax, currency) ?? 0,
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
