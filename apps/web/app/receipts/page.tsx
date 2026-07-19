"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { formatMoney, isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { getCategoryList, getCurrentUser, listReceipts, listUsers, subscribeCategoryList, userName } from "../../lib/data";
import { useDataStore } from "../../lib/store";
import { ReceiptsTable } from "../../components/ReceiptsTable";
import { ManageCategoriesPanel } from "../../components/ManageCategoriesPanel";
import { DownloadIcon } from "../../components/icons";

function exportCsv(rows: ReturnType<typeof listReceipts>) {
  const header = ["Date", "Vendor", "User", "Category", "Total", "Reimbursement"];
  const lines = [header, ...rows.map((r) => [
    r.receiptDate ?? "",
    r.vendor ?? "",
    userName(r.createdBy),
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
  const { version, bump } = useDataStore();
  const categories = useSyncExternalStore(subscribeCategoryList, getCategoryList, getCategoryList);
  const admin = isAdmin(getCurrentUser().role);
  const users = listUsers();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");

  const receipts = useMemo(() => {
    void version;
    return listReceipts({ q: search || undefined, categoryName: categoryFilter, userId: userFilter });
  }, [version, search, categoryFilter, userFilter]);

  const allForExport = useMemo(() => {
    void version;
    return listReceipts({ categoryName: categoryFilter, userId: userFilter });
  }, [version, categoryFilter, userFilter]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em" }}>Receipts</div>
        <button
          type="button"
          onClick={() => exportCsv(allForExport)}
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

      <ReceiptsTable receipts={receipts} categories={categories} onChanged={bump} />

      <ManageCategoriesPanel categories={categories} onChanged={bump} />
    </div>
  );
}
