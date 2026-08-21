import { NextRequest, NextResponse } from "next/server";
import { getFxRate } from "../../../lib/fxRates";
import { requireUser } from "../../../lib/auth";

/**
 * Live rate lookup. Two callers:
 * - The personal display-currency feature (see 0019_personal_display_prefs.sql)
 *   — mobile and the web's own personal views (MyMileagePanel) re-express an
 *   already-fetched, workspace-currency amount for one viewer's screen. Omits
 *   `date`, always looked up for today, display only.
 * - The mobile Review receipt screen's manual currency override (see
 *   capture/confirm.tsx) — passes the receipt's own date, matching the same
 *   date-anchored-to-the-purchase-date principle /api/extract's own
 *   conversion already uses, so a manual correction is priced the same way
 *   an automatic one would have been.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const from = body?.from;
  const to = body?.to;
  const date = body?.date;
  if (typeof from !== "string" || typeof to !== "string") {
    return NextResponse.json({ error: "Both 'from' and 'to' currency codes are required" }, { status: 400 });
  }
  if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json({ error: "'date', if given, must be an ISO YYYY-MM-DD string" }, { status: 400 });
  }

  if (from === to) return NextResponse.json({ rate: null });

  const rateDate = date ?? new Date().toISOString().slice(0, 10);
  const fx = await getFxRate(from, to, rateDate);
  // Unsupported currency or the feed is unreachable: never a fabricated
  // rate — the caller shows the amount unconverted.
  if (!fx) return NextResponse.json({ rate: null });

  return NextResponse.json({ rate: fx.rate, rateDate: fx.rateDate });
}
