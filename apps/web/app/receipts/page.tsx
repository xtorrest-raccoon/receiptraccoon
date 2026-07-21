"use client";

import { useState } from "react";
import { formatMoney, isAdmin, type Receipt } from "@rr/shared";
import type { WorkspaceUser } from "@rr/api";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useCategories, useCurrentUser, useReceipts, useUsers } from "../../lib/queries";
import { ReceiptsTable } from "../../components/ReceiptsTable";
import { ManageCategoriesPanel } from "../../components/ManageCategoriesPanel";
import { DownloadIcon } from "../../components/icons";

function exportCsv(rows: Receipt[], users: WorkspaceUser[]) {
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const header = ["Date", "Vendor", "User", "Category", "Total", "Reimbursement"];
  const lines = [header, ...rows.map((r) => [
    r.receiptDate ?? "",
    r.vendor ?? "",
    nameOf(r.createdBy),
    r.categoryName ?? "Other",
    formatMoney(r.totalMinor, r.currency),
    r.reimbursementStatus,
  ])];
  const csv = lines.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
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
