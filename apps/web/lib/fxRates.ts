import { createClient } from "@supabase/supabase-js";

/**
 * FX rates for /api/extract only — this is deliberately NOT @rr/api. That
 * client is scoped to a signed-in user's session (see setSupabaseClient()),
 * which this route doesn't have yet (see its own stopgap comment); mixing a
 * service-role client into that same singleton would be fragile. fx_rates
 * has no insert/update RLS policy for regular users (see 0001_init.sql's
 * fx_select) — only select — so writing freshly-fetched rates needs the
 * service role, same as every other server-only concern in this app.
 */

const FX_SOURCE = "ECB";

/**
 * Converting at the RECEIPT'S OWN DATE (rather than at scan time) needs a
 * historical rate, not just today's — ECB's daily feed only ever has the
 * latest date. The 90-day feed is the same family of free/no-key feed, just
 * with ~64 trading days of history instead of one. Derived from
 * FX_FEED_URL (the daily feed already configured) rather than adding a
 * second env var, since it's the same host/path family.
 */
function historicalFeedUrl(): string | null {
  const dailyUrl = process.env.FX_FEED_URL;
  if (!dailyUrl) return null;
  return dailyUrl.replace(/eurofxref-daily\.xml$/, "eurofxref-hist-90d.xml");
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface RateSnapshot {
  rateDate: string;
  rates: Record<string, number>;
}

async function cachedSnapshotOnOrBefore(targetDate: string): Promise<RateSnapshot | null> {
  const client = serviceClient();
  const { data: latest } = await client
    .from("fx_rates")
    .select("rate_date")
    .eq("base", "EUR")
    .lte("rate_date", targetDate)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;

  const rateDate = (latest as { rate_date: string }).rate_date;
  const { data: rows } = await client.from("fx_rates").select("quote, rate").eq("rate_date", rateDate).eq("base", "EUR");
  if (!rows || rows.length === 0) return null;

  const rates: Record<string, number> = {};
  for (const row of rows as { quote: string; rate: number }[]) rates[row.quote] = row.rate;
  return { rateDate, rates };
}

/**
 * Fetches and caches every trading day in the 90-day feed in one go — cheap
 * to do since it's one HTTP call regardless, and it means the next ~64
 * trading days' worth of receipts (the overwhelming majority of real-world
 * "scanned a day or two after the purchase" cases) never need another fetch.
 */
async function fetchAndCacheHistory(): Promise<void> {
  const feedUrl = historicalFeedUrl();
  if (!feedUrl) return;

  let xml: string;
  try {
    const res = await fetch(feedUrl);
    if (!res.ok) return;
    xml = await res.text();
  } catch {
    return;
  }

  const rows: { rate_date: string; base: string; quote: string; rate: number; source: string }[] = [];
  // The feed nests one <Cube time="..."> block per trading day, each
  // containing that day's <Cube currency=".." rate=".."/> entries. Quoting
  // style (' vs ") varies between the daily and historical feeds in
  // practice — matched against both live feeds, not assumed.
  for (const dayMatch of xml.matchAll(/<Cube\s+time=['"]([\d-]+)['"]>([\s\S]*?)<\/Cube>/g)) {
    const rateDate = dayMatch[1]!;
    for (const m of dayMatch[2]!.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]\s*\/>/g)) {
      rows.push({ rate_date: rateDate, base: "EUR", quote: m[1]!, rate: Number.parseFloat(m[2]!), source: FX_SOURCE });
    }
  }
  if (rows.length === 0) return;

  await serviceClient().from("fx_rates").upsert(rows, { onConflict: "rate_date,base,quote" });
}

/**
 * The rate for the most recent trading day on or before `targetDate` — ECB
 * doesn't publish weekends/holidays, so this is the "most recent prior rate"
 * fallback DESIGN_V2_DELTA.md §4.2 asks for, generalized to any date rather
 * than just "today". Returns null when targetDate is older than the 90-day
 * window this app caches (rare for a receipt scanned promptly) or the feed
 * is unreachable — callers fall back to "can't convert", never a fabricated
 * rate.
 */
async function getEcbSnapshot(targetDate: string): Promise<RateSnapshot | null> {
  const cached = await cachedSnapshotOnOrBefore(targetDate);
  if (cached) return cached;

  await fetchAndCacheHistory();
  return cachedSnapshotOnOrBefore(targetDate);
}

/**
 * `rate` is units-of-toCurrency per one-unit-of-fromCurrency — matches
 * convertMinor()'s expected shape in @rr/shared/money.ts. `onDate` should be
 * the receipt's own date, so the conversion reflects the day of the actual
 * purchase rather than the day it happened to be scanned.
 */
export async function getFxRate(
  fromCurrency: string,
  toCurrency: string,
  onDate: string,
): Promise<{ rate: number; rateDate: string; source: string } | null> {
  if (fromCurrency === toCurrency) return null;
  const snapshot = await getEcbSnapshot(onDate);
  if (!snapshot) return null;

  const fromRate = fromCurrency === "EUR" ? 1 : snapshot.rates[fromCurrency];
  const toRate = toCurrency === "EUR" ? 1 : snapshot.rates[toCurrency];
  if (fromRate === undefined || toRate === undefined) return null;

  return { rate: toRate / fromRate, rateDate: snapshot.rateDate, source: FX_SOURCE };
}
