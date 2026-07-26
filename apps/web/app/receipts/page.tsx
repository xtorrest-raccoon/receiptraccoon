"use client";

import { useState } from "react";
import { countryForCurrency, countryName, formatMoney, formatShortDate, isAdmin, reclaimedNetMinor, reclaimedTaxMinor, type Receipt } from "@rr/shared";
import type { WorkspaceUser } from "@rr/api";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useCategories, useCurrentUser, useReceipts, useUsers } from "../../lib/queries";
import { ReceiptsTable } from "../../components/ReceiptsTable";
import { ManageCategoriesPanel } from "../../components/ManageCategoriesPanel";
import { DownloadIcon } from "../../components/icons";

function exportCsv(rows: Receipt[], users: WorkspaceUser[]) {
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
  a.download = "receiptraccoon-receipts.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReceiptsPage() {
  const { data: categories } = useCategories();
  const { data: currentUser } = useCurrentUser();
  const { data: users } = useUsers();
  const admin = currentUser ? isAdmin(currentUser.role) : false;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");

  const { data: receipts } = useReceipts({ q: search || undefined, categoryName: categoryFilter, userId: userFilter });
  const { data: allForExport } = useReceipts({ categoryName: categoryFilter, userId: userFilter });

  if (!categories || !users) return null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em" }}>Receipts</div>
        <button
          type="button"
          onClick={() => exportCsv(allForExport ?? [], users)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            border: "none",
            cursor: "pointer",
          }}
        >
          <DownloadIcon color={color.surface} />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap" style={{ gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Search by vendor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            maxWidth: 320,
            padding: "10px 14px",
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            fontSize: fontSize.body,
            background: color.surface,
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            fontSize: fontSize.body,
            background: color.surface,
            fontWeight: fontWeight.semibold,
            color: color.text,
          }}
        >
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {admin ? (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: radius.md,
              border: `1px solid ${color.borderStrong}`,
              fontSize: fontSize.body,
              background: color.surface,
              fontWeight: fontWeight.semibold,
              color: color.text,
            }}
          >
            <option value="All">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <ReceiptsTable receipts={receipts ?? []} categories={categories} users={users} />

      <ManageCategoriesPanel categories={categories} />
    </div>
  );
}
