"use client";

import Link from "next/link";
import { formatMoney, formatShortDate } from "@rr/shared";
import type { Receipt } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useDataStore } from "../lib/store";
import { Avatar } from "./Avatar";
import { CategoryChip, ReceiptStatusChip } from "./Chips";

export function RecentReceiptsTable({ receipts }: { receipts: Receipt[] }) {
  const { openReceipt } = useDataStore();

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Recent receipts</div>
        <Link href="/receipts" style={{ fontSize: fontSize.small + 0.5, fontWeight: fontWeight.bold, color: color.brand, textDecoration: "none" }}>
          View all →
        </Link>
      </div>

      {receipts.length === 0 ? (
        <div style={{ padding: "30px 4px", textAlign: "center", color: color.textFaint, fontSize: fontSize.body }}>
          No receipts yet.
        </div>
      ) : (
        <div className="flex flex-col">
          {receipts.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openReceipt(r.id)}
              className="hidden sm:grid"
              style={{
                gridTemplateColumns: "2fr 1.3fr 1.3fr 1fr 1fr",
                alignItems: "center",
                padding: "12px 4px",
                borderBottom: `1px solid ${color.borderSubtle}`,
                cursor: "pointer",
                background: "none",
                border: "none",
                textAlign: "left",
                width: "100%",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: fontWeight.bold, color: color.text }}>
                <Avatar name={r.vendor ?? "?"} />
                {r.vendor}
              </div>
              <div style={{ color: color.textMuted }}>{r.receiptDate ? formatShortDate(r.receiptDate) : "—"}</div>
              <div>
                <CategoryChip category={r.categoryName ?? "Other"} />
              </div>
              <div style={{ fontWeight: fontWeight.bold, color: color.text }}>{formatMoney(r.totalMinor, r.currency)}</div>
              <div>
                <ReceiptStatusChip status={r.status} />
              </div>
            </button>
          ))}

          {receipts.map((r) => (
            <button
              key={`${r.id}-card`}
              type="button"
              onClick={() => openReceipt(r.id)}
              className="flex sm:hidden"
              style={{
                flexDirection: "column",
                gap: 6,
                padding: "12px 4px",
                borderBottom: `1px solid ${color.borderSubtle}`,
                cursor: "pointer",
                background: "none",
                border: "none",
                textAlign: "left",
                width: "100%",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: fontWeight.bold, color: color.text }}>
                  <Avatar name={r.vendor ?? "?"} />
                  {r.vendor}
                </div>
                <div style={{ fontWeight: fontWeight.bold, color: color.text }}>{formatMoney(r.totalMinor, r.currency)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: color.textMuted, fontSize: fontSize.small }}>{r.receiptDate ? formatShortDate(r.receiptDate) : "—"}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <CategoryChip category={r.categoryName ?? "Other"} />
                  <ReceiptStatusChip status={r.status} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
