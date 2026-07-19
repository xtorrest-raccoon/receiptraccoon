import { Decimal } from "decimal.js";

/**
 * All money in this system is an integer count of minor units (cents, pence, yen).
 * Never a float. `12.10 + 0.20 !== 12.30` in IEEE-754, and this is an app that
 * reconciles against people's accounting ledgers.
 *
 * The extraction model returns decimal *strings* precisely so nothing is ever
 * parsed through a JS number on the way in.
 */

/** Currencies with no minor unit. Cents-per-unit is 1, not 100. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", "KRW", "VND", "CLP", "ISK", "UGX", "PYG", "RWF", "XAF", "XOF", "XPF",
]);

export function minorUnitsPerUnit(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/**
 * Parse a decimal string ("16.80") into minor units (1680).
 * Returns null for anything that isn't a finite number — callers must handle it
 * rather than silently coercing to 0. A receipt total that fails to parse is a
 * review item, not a zero-dollar expense.
 */
export function parseMoneyToMinor(value: string | null | undefined, currency: string): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.trim().replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  try {
    const d = new Decimal(cleaned);
    if (!d.isFinite()) return null;
    return d.times(minorUnitsPerUnit(currency)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    return null;
  }
}

/** Minor units back to a decimal string, for display or export. */
export function minorToDecimalString(minor: number, currency: string): string {
  const per = minorUnitsPerUnit(currency);
  return new Decimal(minor).dividedBy(per).toFixed(per === 1 ? 0 : 2);
}

/**
 * Convert an amount between currencies at a fixed rate.
 * `rate` is units-of-target per one-unit-of-source.
 *
 * The rate is always supplied by the caller and stored on the row — we never look
 * up a rate at read time, because a receipt's home-currency value must not drift
 * after the fact. See DESIGN_V2_DELTA.md §4.1.
 */
export function convertMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): number {
  const fromPer = minorUnitsPerUnit(fromCurrency);
  const toPer = minorUnitsPerUnit(toCurrency);
  return new Decimal(amountMinor)
    .dividedBy(fromPer)
    .times(rate)
    .times(toPer)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** subtotal + tax === total, within a one-minor-unit tolerance for rounding. */
export function arithmeticChecks(
  subtotalMinor: number | null,
  taxMinor: number | null,
  totalMinor: number | null,
): boolean {
  if (subtotalMinor === null || totalMinor === null) return false;
  const tax = taxMinor ?? 0;
  return Math.abs(subtotalMinor + tax - totalMinor) <= 1;
}
