import { NextRequest, NextResponse } from "next/server";
import { getFxRate } from "../../../lib/fxRates";
import { requireUser } from "../../../lib/auth";

/**
 * Live rate lookup for the personal display-currency feature (see
 * 0019_personal_display_prefs.sql) — mobile and the web's own personal
 * views (MyMileagePanel) call this to re-express an already-fetched,
 * workspace-currency amount for one viewer's screen. Never used for the
 * scan-time conversion frozen on a receipt (see /api/extract) — this is
 * always looked up fresh, today, for display only.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const from = body?.from;
  const to = body?.to;
  if (typeof from !== "string" || typeof to !== "string") {
    return NextResponse.json({ error: "Both 'from' and 'to' currency codes are required" }, { status: 400 });
  }

  if (from === to) return NextResponse.json({ rate: null });

  const today = new Date().toISOString().slice(0, 10);
  const fx = await getFxRate(from, to, today);
  // Unsupported currency or the feed is unreachable: never a fabricated
  // rate — the caller shows the amount unconverted.
  if (!fx) return NextResponse.json({ rate: null });

  return NextResponse.json({ rate: fx.rate, rateDate: fx.rateDate });
}
