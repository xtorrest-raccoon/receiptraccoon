import { minorUnitsPerUnit } from "./money.js";

/**
 * Display formatting. Shared so the web table, the mobile list, and the CSV export
 * can never disagree about how a number reads.
 *
 * The v1 design hardcoded USD (`fmtUsd`). Design v2 added multi-currency, so
 * everything here takes an explicit currency — there is no dollar-shaped default.
 */

export function formatMoney(minor: number, currency: string, locale = "en-US"): string {
  const per = minorUnitsPerUnit(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: per === 1 ? 0 : 2,
    maximumFractionDigits: per === 1 ? 0 : 2,
  }).format(minor / per);
}

/** Compact form for chart labels: "$1,234" with no decimals. */
export function formatMoneyCompact(minor: number, currency: string, locale = "en-US"): string {
  const per = minorUnitsPerUnit(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / per);
}

/**
 * Just the currency symbol ("€", "$", "£").
 *
 * For editable amount fields, where the value itself must stay a plain number the
 * user can type into, but the field still needs to show which currency it is in.
 *
 * Deliberately avoids Intl.NumberFormat.formatToParts: it is not reliably
 * implemented in Hermes, React Native's JS engine, and threw when opening a
 * receipt on a real device. Formatting zero and stripping the numeric parts works
 * on every engine. The whole thing is wrapped anyway — a missing symbol must never
 * take down a screen.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  JPY: "¥",
  CHF: "CHF",
  CAD: "CA$",
  AUD: "A$",
};

export function currencySymbol(currency: string, locale = "en-US"): string {
  const code = currency.toUpperCase();
  const known = CURRENCY_SYMBOLS[code];
  if (known) return known;
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(0);
    // Strip digits, separators, and every flavour of space (incl. non-breaking).
    const stripped = formatted.replace(/[\d\s  .,]/g, "");
    return stripped || code;
  } catch {
    return code;
  }
}

/**
 * A representative country for a currency code — for the CSV export's
 * Country column, not for anything a payment or compliance decision reads.
 * A currency isn't 1:1 with a country (EUR alone spans ~20), so this is
 * necessarily approximate: the currency's most common issuing country, or
 * "Eurozone" for EUR since no single country is more "correct" than another.
 * Covers this app's home-currency options (@rr/api's SUPPORTED_CURRENCIES)
 * plus every currency the ECB's daily reference feed publishes (the
 * complete set a foreign-currency receipt's originalCurrency can be). Falls
 * back to the bare code for anything outside that set rather than guessing.
 */
const CURRENCY_COUNTRIES: Record<string, string> = {
  EUR: "Eurozone",
  USD: "United States",
  GBP: "United Kingdom",
  CHF: "Switzerland",
  CAD: "Canada",
  AUD: "Australia",
  JPY: "Japan",
  MXN: "Mexico",
  INR: "India",
  BRL: "Brazil",
  CZK: "Czech Republic",
  DKK: "Denmark",
  HUF: "Hungary",
  PLN: "Poland",
  RON: "Romania",
  SEK: "Sweden",
  ISK: "Iceland",
  NOK: "Norway",
  TRY: "Turkey",
  CNY: "China",
  HKD: "Hong Kong",
  IDR: "Indonesia",
  ILS: "Israel",
  KRW: "South Korea",
  MYR: "Malaysia",
  NZD: "New Zealand",
  PHP: "Philippines",
  SGD: "Singapore",
  THB: "Thailand",
  ZAR: "South Africa",
  BGN: "Bulgaria",
};

export function countryForCurrency(currency: string): string {
  return CURRENCY_COUNTRIES[currency.toUpperCase()] ?? currency.toUpperCase();
}

/**
 * Every currency code this app can actually resolve an FX rate for (the ECB
 * daily reference feed's own set — see getFxRate/CURRENCY_COUNTRIES above).
 * For the Review receipt screen's manual currency picker: a receipt can be
 * in any of these regardless of the narrower @rr/api SUPPORTED_CURRENCIES
 * list, which only governs what a WORKSPACE's own home currency can be set
 * to, a much narrower/deliberate choice.
 */
export const RECEIPT_CURRENCIES: readonly string[] = Object.keys(CURRENCY_COUNTRIES).sort();

/**
 * Full name for an ISO 3166-1 alpha-2 country code ("FR" -> "France") — for
 * the receipt's own detected country (see Receipt.country), which unlike
 * currency maps 1:1 onto a real country, so no hand-rolled table is needed
 * here: Intl.DisplayNames covers every ISO 3166 code natively. Falls back to
 * the bare code if the runtime's Intl data doesn't recognise it.
 */
export function countryName(iso2: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(iso2.toUpperCase()) ?? iso2.toUpperCase();
  } catch {
    return iso2.toUpperCase();
  }
}

/** "Jul 18" — matches the design's fmtDate(). */
export function formatShortDate(iso: string, locale = "en-US"): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

/** "July 2026" — for the month picker. */
export function formatMonthLabel(yyyyMm: string, locale = "en-US"): string {
  return new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

/** Two-letter vendor/person initials for avatar chips. Matches the design. */
export function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (first + second).toUpperCase();
}

/** "Visa •4521" — the design shows this as one string; we store the parts. */
export function formatPaymentMethod(
  brand: string | null,
  last4: string | null,
): string | null {
  if (!brand && !last4) return null;
  if (!last4) return brand;
  if (!brand) return `•${last4}`;
  return `${brand} •${last4}`;
}

/**
 * Arrow boundary is `> 0`, not `>= 0`: flat spend (exactly 0.0%) reads as "not
 * up", matching the colour convention already used on the web dashboard's stat
 * card (`deltaUp = stats.monthDeltaPct > 0`) — otherwise flat spend would show
 * an "up" arrow while being coloured as the good outcome.
 */
function deltaArrow(pct: number): "↑" | "↓" {
  return pct > 0 ? "↑" : "↓";
}

/** "↓12.4%" — the bare figure, for tight spaces like a ring's centre. */
export function formatDeltaCompact(pct: number): string {
  return `${deltaArrow(pct)}${Math.abs(pct).toFixed(1)}%`;
}

/** "↓ 12.4% vs last month" — the full sentence, for a stat card's subtitle. */
export function formatDelta(pct: number): string {
  return `${deltaArrow(pct)} ${Math.abs(pct).toFixed(1)}% vs last month`;
}

/** Below this, the swing is noise and "more/less" would overstate it. */
const PACE_FLAT_THRESHOLD_PCT = 0.5;

/**
 * "34% ahead of last month's pace".
 *
 * Says "pace" rather than a bare "vs last month" on purpose: the figure compares
 * the month so far against the same day-of-month last month, not against last
 * month's full total. Comparing a partial month to a complete one reads as a
 * decrease almost every month until the very last day, so the wording has to
 * carry that nuance without spelling out "at the same point", which is too long
 * for a caption.
 *
 * Whole percentages — a tenth of a percent is noise at this size.
 */
export function formatPaceComparison(deltaPct: number): string {
  if (Math.abs(deltaPct) < PACE_FLAT_THRESHOLD_PCT) return "On last month's pace";
  const direction = deltaPct > 0 ? "ahead of" : "behind";
  return `${Math.abs(deltaPct).toFixed(0)}% ${direction} last month's pace`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}
