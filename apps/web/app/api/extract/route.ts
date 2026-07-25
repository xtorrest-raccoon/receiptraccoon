import { NextRequest, NextResponse } from "next/server";
import { extractReceipt } from "@rr/extraction";
import { SEED_CATEGORIES, convertMinor, parseMoneyToMinor } from "@rr/shared";
import { getFxRate } from "../../../lib/fxRates";

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
  // real session): lib/data.ts's listCategories() would need an
  // authenticated client this route doesn't have yet — resolving "which
  // workspace" needs the caller's identity, which isn't wired through here
  // yet either. Falls back to the seed category list in the meantime.
  //
  // homeCurrency, unlike categories, doesn't need that auth wiring: the
  // caller (mobile) already knows its own real home currency via
  // useHomeCurrency() and just sends it along, same as it sends the photo.
  const homeCurrency = (formData.get("homeCurrency") as string) || "EUR";
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
    // receipt (flagged as a soft validation issue in validate.ts when it
    // differs from home). Converted below using the ECB rate of the day —
    // frozen on the receipt via fxRate/fxRateDate so it never drifts on
    // re-read, per DESIGN_V2_DELTA.md §4.1.
    const receiptCurrency = d.currency ?? homeCurrency;
    let totalMinor = parseMoneyToMinor(d.total, receiptCurrency) ?? 0;
    let taxMinor = parseMoneyToMinor(d.tax, receiptCurrency) ?? 0;
    let originalCurrency: string | null = null;
    let originalTotalMinor: number | null = null;
    let fxRate: number | null = null;
    let fxRateDate: string | null = null;

    if (receiptCurrency !== homeCurrency) {
      const fx = await getFxRate(receiptCurrency, homeCurrency);
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
