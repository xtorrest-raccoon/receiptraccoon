"use client";

import { useState } from "react";
import { type ReimbursementStatus } from "@rr/shared";
import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import { useCategories, useCurrentUser, useReceipts, useUsers } from "../../lib/queries";
import { useDataStore } from "../../lib/store";
import { exportReceiptsCsv } from "../../lib/receiptsCsv";
import { ReceiptsTable } from "../../components/ReceiptsTable";
import { DownloadIcon, UploadIcon } from "../../components/icons";

const STATUS_OPTIONS: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];

/**
 * Always scoped to the signed-in user's own receipts, for everyone
 * regardless of role — the company-wide, filterable-by-user view moved to
 * Team, which is the one place for reviewing everyone's spend. RLS would
 * enforce the "own only" half of this anyway for a plain member, but an
 * admin/owner gets scoped down here too now, on purpose, to keep this page a
 * personal expense log.
 */
export default function ReceiptsPage() {
  const { data: categories } = useCategories();
  const { data: currentUser } = useCurrentUser();
  const { data: users } = useUsers();
  const { openAddReceipt } = useDataStore();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | ReimbursementStatus>("All");

  const { data: receipts } = useReceipts({ q: search || undefined, categoryName: categoryFilter, userId: currentUser?.id });
  const { data: allForExport } = useReceipts({ categoryName: categoryFilter, userId: currentUser?.id });

  if (!categories || !users || !currentUser) return null;

  // Client-side, same reasoning as categoryName in @rr/api's listReceipts —
  // the row count per workspace doesn't justify a server-side filter here.
  const filteredReceipts = statusFilter === "All" ? receipts ?? [] : (receipts ?? []).filter((r) => r.reimbursementStatus === statusFilter);
  const filteredForExport = statusFilter === "All" ? allForExport ?? [] : (allForExport ?? []).filter((r) => r.reimbursementStatus === statusFilter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em" }}>Receipts</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={openAddReceipt}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: radius.md,
              background: color.surfaceMuted,
              color: color.text,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              border: "none",
              cursor: "pointer",
            }}
          >
            <UploadIcon color={color.text} />
            Upload receipt
          </button>
          <button
            type="button"
            onClick={() => exportReceiptsCsv(filteredForExport, users, "receiptraccoon-my-receipts.csv")}
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "All" | ReimbursementStatus)}
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
          <option value="All">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {reimbursementChip[s].label}
            </option>
          ))}
        </select>
      </div>

      <ReceiptsTable receipts={filteredReceipts} categories={categories} users={users} />
    </div>
  );
}
