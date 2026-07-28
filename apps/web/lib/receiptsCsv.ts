import { countryForCurrency, countryName, formatMoney, formatShortDate, reclaimedNetMinor, reclaimedTaxMinor, type Receipt } from "@rr/shared";
import type { WorkspaceUser } from "@rr/api";

/** Shared by the personal Receipts page and Team's company-wide Receipts section — same columns either way. */
export function exportReceiptsCsv(rows: Receipt[], users: WorkspaceUser[], filename: string) {
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const header = [
    "Date", "Vendor", "User", "Category", "Country", "Currency", "Net amount", "Tax", "Total",
    "Currency conversion", "Comment", "Reimbursement",
  ];
  const lines = [header, ...rows.map((r) => [
    r.receiptDate ?? "",
    r.vendor ?? "",
    nameOf(r.createdBy),
    r.categoryName ?? "Other",
    // Prefer the country actually detected on the receipt (real, not a
    // currency-based guess — the only way to tell French from German EUR
    // receipts). Falls back to the currency-based guess for receipts
    // captured before country detection existed, or a genuinely unclear photo.
    r.country ? countryName(r.country) : countryForCurrency(r.originalCurrency ?? r.currency),
    r.currency,
    reclaimedNetMinor(r) !== null ? formatMoney(reclaimedNetMinor(r)!, r.currency) : "",
    reclaimedTaxMinor(r) !== null ? formatMoney(reclaimedTaxMinor(r)!, r.currency) : "",
    formatMoney(r.totalMinor, r.currency),
    // Same info as the web Receipt drawer's "Currency conversion" banner —
    // only populated for a receipt that was actually printed in a different
    // currency (see @rr/shared's Receipt type).
    r.originalCurrency && r.originalTotalMinor !== null
      ? `Originally ${formatMoney(r.originalTotalMinor, r.originalCurrency)} at ${r.fxRate}${r.fxRateDate ? ` on ${formatShortDate(r.fxRateDate)}` : ""}`
      : "",
    r.comment ?? "",
    r.reimbursementStatus,
  ])];
  // Excel doesn't assume UTF-8 for a bare CSV — without the BOM it reads "€"
  // (multi-byte UTF-8) as the system codepage and mangles it into "â‚¬".
  const csv = "﻿" + lines.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
