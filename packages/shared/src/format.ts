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

/** "↓ 12.4% vs last month" */
export function formatDelta(pct: number): string {
  const arrow = pct >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct).toFixed(1)}% vs last month`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}
