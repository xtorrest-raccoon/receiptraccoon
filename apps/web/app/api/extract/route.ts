import { NextRequest, NextResponse } from "next/server";
import { extractReceipt } from "@rr/extraction";
import { parseMoneyToMinor } from "@rr/shared";
import { getHomeCurrency, listCategories } from "../../../lib/data";

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
  const homeCurrency = getHomeCurrency();
  const categories = listCategories();

  try {
    const outcome = await extractReceipt({
      image,
      mimeType: file.type || "image/jpeg",
      categories,
      homeCurrency,
    });

    const d = outcome.result.data;
    // Extraction returns decimal strings in whatever currency it read off the
    // receipt. No FX conversion happens here — a foreign-currency receipt is
    // already flagged as a soft validation issue (see validate.ts) and needs a
    // human to confirm the rate, same as everywhere else in the app.
    const currency = d.currency ?? homeCurrency;

    return NextResponse.json({
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
