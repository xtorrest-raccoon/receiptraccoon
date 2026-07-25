import { createClient } from "@supabase/supabase-js";

/**
 * FX rates for /api/extract only — this is deliberately NOT @rr/api. That
 * client is scoped to a signed-in user's session (see setSupabaseClient()),
 * which this route doesn't have yet (see its own stopgap comment); mixing a
 * service-role client into that same singleton would be fragile. fx_rates
 * has no insert/update RLS policy for regular users (see 0001_init.sql's
 * fx_select) — only select — so writing a freshly-fetched day's rates needs
 * the service role, same as every other server-only concern in this app.
 */

const FX_SOURCE = "ECB";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface RateSnapshot {
  rateDate: string;
  rates: Record<string, number>;
}

/**
 * ECB's daily feed always returns its OWN latest available date (Friday's,
 * over a weekend) regardless of when it's fetched — that IS
 * DESIGN_V2_DELTA.md §4.2's "use the most recent prior rate" fallback, no
 * extra logic needed here. The cache below is keyed by calendar date rather
 * than the feed's own date, so an occasional redundant re-fetch can happen
 * right after a non-trading day boundary — accepted simplification: the feed
 * is free/unauthenticated and this app's scan volume doesn't warrant a
 * smarter cache key.
 */
async function getEcbSnapshot(): Promise<RateSnapshot | null> {
  const today = new Date().toISOString().slice(0, 10);
  const client = serviceClient();

  const { data: cached } = await client.from("fx_rates").select("quote, rate").eq("rate_date", today).eq("base", "EUR");
  if (cached && cached.length > 0) {
    const rates: Record<string, number> = {};
    for (const row of cached as { quote: string; rate: number }[]) rates[row.quote] = row.rate;
    return { rateDate: today, rates };
  }

  const feedUrl = process.env.FX_FEED_URL;
  if (!feedUrl) return null;

  let xml: string;
  try {
    const res = await fetch(feedUrl);
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  }

  // The feed quotes attribute values with single quotes ('2026-07-24'), not
  // the double quotes a hand-written example might guess at — matched
  // against the live feed, not assumed.
  const dateMatch = xml.match(/<Cube\s+time=['"]([\d-]+)['"]/);
  if (!dateMatch) return null;
  const rateDate = dateMatch[1]!;

  const rates: Record<string, number> = {};
  for (const m of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]\s*\/>/g)) {
    rates[m[1]!] = Number.parseFloat(m[2]!);
  }
  if (Object.keys(rates).length === 0) return null;

  const rows = Object.entries(rates).map(([quote, rate]) => ({
    rate_date: rateDate,
    base: "EUR",
    quote,
    rate,
    source: FX_SOURCE,
  }));
  await client.from("fx_rates").upsert(rows, { onConflict: "rate_date,base,quote" });

  return { rateDate, rates };
}

/**
 * `rate` is units-of-toCurrency per one-unit-of-fromCurrency — matches
 * convertMinor()'s expected shape in @rr/shared/money.ts.
 * Returns null when either currency isn't ECB-published or the feed is
 * unreachable — callers must fall back to "can't convert" rather than
 * fabricating a rate.
 */
export async function getFxRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<{ rate: number; rateDate: string; source: string } | null> {
  if (fromCurrency === toCurrency) return null;
  const snapshot = await getEcbSnapshot();
  if (!snapshot) return null;

  const fromRate = fromCurrency === "EUR" ? 1 : snapshot.rates[fromCurrency];
  const toRate = toCurrency === "EUR" ? 1 : snapshot.rates[toCurrency];
  if (fromRate === undefined || toRate === undefined) return null;

  return { rate: toRate / fromRate, rateDate: snapshot.rateDate, source: FX_SOURCE };
}
