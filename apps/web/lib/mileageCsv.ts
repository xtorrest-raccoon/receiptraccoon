import { currencySymbol, formatMoney, rateToDecimalString, type MileageTrip } from "@rr/shared";
import type { WorkspaceUser } from "@rr/api";
import { downloadCsv } from "./csv";

/** Shared by the personal Mileage page and Team's mileage section — same columns either way. */
export function exportMileageCsv(rows: MileageTrip[], users: WorkspaceUser[], currency: string, filename: string) {
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const header = ["Date", "User", "Purpose", "Distance", "Rate", "Amount", "Status"];
  const lines = [header, ...rows.map((t) => [
    t.tripDate,
    nameOf(t.userId),
    t.purpose,
    `${t.distance.toFixed(1)} ${t.distanceUnit}`,
    `${currencySymbol(currency)}${rateToDecimalString(t.rateMilli)}/${t.rateUnit}`,
    formatMoney(t.amountMinor, currency),
    t.reimbursementStatus,
  ])];
  downloadCsv(lines, filename);
}
