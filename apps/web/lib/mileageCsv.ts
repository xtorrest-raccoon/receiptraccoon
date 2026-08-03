import { currencySymbol, formatMoney, formatShortDate, rateToDecimalString, type MileageTrip } from "@rr/shared";
import type { WorkspaceUser } from "@rr/api";
import { downloadCsv } from "./csv";

/** Shared by the personal Mileage page and Team's mileage section — same columns either way. */
export function exportMileageCsv(rows: MileageTrip[], users: WorkspaceUser[], currency: string, filename: string) {
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const header = ["Date", "User", "Purpose", "Distance", "Rate", "Amount", "Currency conversion", "Status"];
  const lines = [header, ...rows.map((t) => [
    t.tripDate,
    nameOf(t.userId),
    t.purpose,
    `${t.distance.toFixed(1)} ${t.distanceUnit}`,
    // The rate is in t.originalCurrency if it was set in a currency other
    // than the workspace's own (see 0034_mileage_rate_currency.sql) — the
    // `currency` param (always the workspace's own) is only right for the
    // Amount column below, which amount_minor always is.
    `${currencySymbol(t.originalCurrency ?? currency)}${rateToDecimalString(t.rateMilli)}/${t.rateUnit}`,
    formatMoney(t.amountMinor, currency),
    t.originalCurrency && t.originalAmountMinor !== null
      ? `Originally ${formatMoney(t.originalAmountMinor, t.originalCurrency)}${t.fxRate ? ` at ${t.fxRate}` : ""}${t.fxRateDate ? ` on ${formatShortDate(t.fxRateDate)}` : ""}`
      : "",
    t.reimbursementStatus,
  ])];
  downloadCsv(lines, filename);
}
