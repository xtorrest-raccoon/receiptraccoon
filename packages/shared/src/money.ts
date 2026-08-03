import { Decimal } from "decimal.js";
import type { DashboardResponse, MileageTrip, OwedToUserSummary, Receipt } from "./types.js";

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
  // A decimal-pad keyboard on some device locales emits "," for the decimal
  // point, so typing "5.2" can land as "5,2". Treat "," as the decimal
  // separator when no "." is present; otherwise it's a thousands separator
  // ("1,234.56") and gets dropped like any other stray character. Without
  // this, the character-class strip below silently deletes the comma and
  // "5,2" becomes "52" — a 10x error, not a rejected input.
  const withDot = value.includes(".") ? value.replace(/,/g, "") : value.replace(",", ".");
  const cleaned = withDot.trim().replace(/[^0-9.\-]/g, "");
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

/**
 * Mileage rates carry three decimals — statutory rates are quoted that way
 * (France's barème kilométrique, the IRS's $0.655/mile), and rounding to cents
 * would silently change what someone is owed over a long trip.
 *
 * So a rate is stored as an integer count of THOUSANDTHS of a currency unit:
 * €0.675 is 675. Deliberately not a float, for the same reason amounts are not.
 */
export const RATE_SCALE = 1000;

/** 675 -> "0.675" */
export function rateToDecimalString(rateMilli: number): string {
  return new Decimal(rateMilli).dividedBy(RATE_SCALE).toFixed(3);
}

/** "0.675" -> 675. Null when unparseable, so callers must handle it. */
export function parseRateToMilli(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  // Accept the comma decimal separator: this is a euro-based product and a French
  // user typing "0,675" means the same thing as "0.675".
  const cleaned = value.trim().replace(",", ".").replace(/[^0-9.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  try {
    const d = new Decimal(cleaned);
    if (!d.isFinite() || d.isNegative()) return null;
    return d.times(RATE_SCALE).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    return null;
  }
}

/** Kilometres per mile. Lives here because it is part of the money calculation. */
export const MI_TO_KM = 1.60934;

/**
 * What a trip is worth, in minor units.
 *
 * `distance` and `rateMilli` MUST be expressed in the same unit. Prefer
 * mileageAmountForTrip below, which takes the unit explicitly — mixing a kilometre
 * distance with a per-mile rate silently overpays by 61%, which is exactly the bug
 * this signature allowed.
 */
export function mileageAmountMinor(
  distance: number,
  rateMilli: number,
  currency: string,
): number {
  return new Decimal(distance)
    .times(rateMilli)
    .times(minorUnitsPerUnit(currency))
    .dividedBy(RATE_SCALE)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * What a trip is worth, given a rate expressed per `rateUnit` and the unit
 * the trip's distance was actually logged in — converts distance into
 * `rateUnit`'s terms rather than assuming the rate is always per-mile.
 * Getting this backwards previously underpaid every km-rate workspace by
 * ~38% (a rate meant as "per km" was applied as if it were "per mile") —
 * see 0014_mileage_rate_unit.sql.
 *
 * One implementation so the mobile entry form, the web team table, and the
 * server cannot disagree about someone's reimbursement.
 */
export function mileageAmountForTrip(
  distance: number,
  distanceUnit: "mi" | "km",
  rateMilli: number,
  rateUnit: "mi" | "km",
  currency: string,
): number {
  const distanceInRateUnit =
    distanceUnit === rateUnit
      ? new Decimal(distance)
      : rateUnit === "mi"
        ? new Decimal(distance).dividedBy(MI_TO_KM)
        : new Decimal(distance).times(MI_TO_KM);

  return distanceInRateUnit
    .times(rateMilli)
    .times(minorUnitsPerUnit(currency))
    .dividedBy(RATE_SCALE)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * The claimable amount for a receipt.
 *
 * Defaults to the full total when no partial claim has been set. Every spend
 * aggregate and every reimbursement figure must go through this — reading
 * `totalMinor` directly is how a partial claim silently becomes a full one.
 */
export function reclaimMinor(receipt: {
  totalMinor: number;
  reclaimMinor: number | null;
}): number {
  return receipt.reclaimMinor ?? receipt.totalMinor;
}

/**
 * The tax rate as a fraction of the subtotal (net amount) — e.g. `0.2` for a
 * 20% VAT receipt. Null when there's no subtotal to divide by (missing, or
 * zero) or tax wasn't captured — never a fabricated rate.
 */
export function taxRate(receipt: { subtotalMinor: number | null; taxMinor: number | null }): number | null {
  if (receipt.taxMinor === null || !receipt.subtotalMinor) return null;
  return receipt.taxMinor / receipt.subtotalMinor;
}

/**
 * The tax embedded in the portion actually being claimed back, not the
 * receipt's full tax — a partial reclaim (a shared bill, a mixed
 * business/personal trip) only claims a fraction of the total, so the tax
 * relevant to reimbursement scales down by that same fraction. Returns the
 * full tax, unscaled, when no partial claim is set (reclaimMinor null means
 * "the whole total" — see reclaimMinor() above).
 */
export function reclaimedTaxMinor(receipt: {
  totalMinor: number;
  taxMinor: number | null;
  reclaimMinor: number | null;
}): number | null {
  if (receipt.taxMinor === null) return null;
  if (receipt.reclaimMinor === null || receipt.totalMinor <= 0) return receipt.taxMinor;
  return new Decimal(receipt.taxMinor).times(receipt.reclaimMinor).dividedBy(receipt.totalMinor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * The net (pre-tax) amount for the portion actually being claimed back.
 * Deliberately reclaimMinor() minus reclaimedTaxMinor() — not its own
 * independently-rounded proration of subtotalMinor — so Net + Tax always
 * sums exactly to the reclaimed amount; two separately-rounded splits of the
 * same total can drift apart by a minor unit against each other.
 */
export function reclaimedNetMinor(receipt: {
  totalMinor: number;
  subtotalMinor: number | null;
  taxMinor: number | null;
  reclaimMinor: number | null;
}): number | null {
  if (receipt.subtotalMinor === null) return null;
  const tax = reclaimedTaxMinor(receipt);
  if (tax === null) return null;
  return reclaimMinor(receipt) - tax;
}

/**
 * Personal display-currency conversion — NOT the scan-time conversion above
 * (that one is frozen forever on the row). This re-expresses an already-
 * fetched, workspace-currency object for one viewer's screen, using a live
 * rate fetched at read time. `originalCurrency`/`originalTotalMinor`/
 * `fxRate` describe the receipt's own foreign currency at scan time and are
 * deliberately left untouched — converting those would misrepresent what
 * the receipt itself said.
 */
export function convertReceiptCurrency(receipt: Receipt, toCurrency: string, rate: number): Receipt {
  if (receipt.currency === toCurrency) return receipt;
  const convert = (m: number | null) => (m === null ? null : convertMinor(m, receipt.currency, toCurrency, rate));
  return {
    ...receipt,
    currency: toCurrency,
    subtotalMinor: convert(receipt.subtotalMinor),
    taxMinor: convert(receipt.taxMinor),
    totalMinor: convertMinor(receipt.totalMinor, receipt.currency, toCurrency, rate),
    reclaimMinor: convert(receipt.reclaimMinor),
    lineItems: receipt.lineItems.map((li) => ({
      ...li,
      unitPriceMinor: convertMinor(li.unitPriceMinor, receipt.currency, toCurrency, rate),
      amountMinor: convertMinor(li.amountMinor, receipt.currency, toCurrency, rate),
    })),
  };
}

/**
 * Same personal-display conversion, applied to every aggregate amount a
 * dashboard carries — see convertReceiptCurrency above.
 *
 * Deliberately does NOT touch recentReceipts' own amounts: `rate` is
 * dashboard.currency -> toCurrency, but an individual receipt can carry a
 * DIFFERENT currency of its own (captured before the workspace's currency
 * was last changed — receipts are never retroactively reconverted, see
 * Setup's currency card). Applying this single rate to such a receipt would
 * silently produce a wrong number — the same mistake the Receipts page's
 * own list once made (fixed by resolving one rate per distinct receipt
 * currency, see useFxRatesTo). Callers that display recentReceipts (see
 * apps/web/app/dashboard/page.tsx) need to apply that same per-receipt
 * conversion themselves rather than this function's single rate.
 */
export function convertDashboardCurrency(dashboard: DashboardResponse, toCurrency: string, rate: number): DashboardResponse {
  if (dashboard.currency === toCurrency) return dashboard;
  const convert = (m: number) => convertMinor(m, dashboard.currency, toCurrency, rate);
  return {
    ...dashboard,
    currency: toCurrency,
    stats: {
      ...dashboard.stats,
      monthTotalMinor: convert(dashboard.stats.monthTotalMinor),
      ytdTotalMinor: convert(dashboard.stats.ytdTotalMinor),
      taxMinor: convert(dashboard.stats.taxMinor),
      reimbursableMinor: convert(dashboard.stats.reimbursableMinor),
    },
    pacing: {
      ...dashboard.pacing,
      prevMonthTotalMinor: convert(dashboard.pacing.prevMonthTotalMinor),
      prevMonthToDateMinor: convert(dashboard.pacing.prevMonthToDateMinor),
    },
    weeklySpend: dashboard.weeklySpend.map((w) => ({ ...w, totalMinor: convert(w.totalMinor) })),
    categoryBreakdown: dashboard.categoryBreakdown.map((row) => ({ ...row, amountMinor: convert(row.amountMinor) })),
  };
}

/**
 * `OwedToUserSummary`/`MileageTrip` carry no `currency` field of their own
 * (unlike Receipt/DashboardResponse) — the caller must supply what currency
 * the amount is actually in (the workspace's, always, today).
 */
export function convertOwedToUserCurrency(
  owed: OwedToUserSummary,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): OwedToUserSummary {
  if (fromCurrency === toCurrency) return owed;
  return { ...owed, amountMinor: convertMinor(owed.amountMinor, fromCurrency, toCurrency, rate) };
}

/** Converts amountMinor only — distance/rateMilli/units are frozen reimbursement facts, not currency fields. */
export function convertMileageTripCurrency(
  trip: MileageTrip,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): MileageTrip {
  if (fromCurrency === toCurrency) return trip;
  return { ...trip, amountMinor: convertMinor(trip.amountMinor, fromCurrency, toCurrency, rate) };
}

/**
 * For displaying a reimbursement rate (e.g. "€0.700/mi") in a viewer's
 * personal currency. Milli is currency-agnostic thousandths, not minor
 * units, so this is a plain multiply — convertMinor's per-currency decimal
 * scaling does not apply here.
 */
export function convertRateMilliCurrency(rateMilli: number, fromCurrency: string, toCurrency: string, rate: number): number {
  if (fromCurrency === toCurrency) return rateMilli;
  return Math.round(rateMilli * rate);
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
