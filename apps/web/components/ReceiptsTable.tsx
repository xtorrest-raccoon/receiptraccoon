"use client";

import { categoryChipColor, formatMoney, formatShortDate, isAdmin, reclaimedNetMinor, reclaimedTaxMinor, type ReimbursementStatus } from "@rr/shared";
import type { Receipt } from "@rr/shared";
import type { WorkspaceUser } from "@rr/api";
import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import { useCurrentUser, useSetCategory } from "../lib/queries";
import { useDataStore } from "../lib/store";
import { Avatar } from "./Avatar";
import { CategoryChip } from "./Chips";

const STATUS_OPTIONS: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];

function nameOf(users: WorkspaceUser[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? "Unknown";
}

export function ReceiptsTable({
  receipts,
  categories,
  users,
}: {
  receipts: Receipt[];
  categories: string[];
  users: WorkspaceUser[];
}) {
  const { openReceipt, requestReimbursementChange } = useDataStore();
  const { data: currentUser } = useCurrentUser();
  const admin = currentUser ? isAdmin(currentUser.role) : false;
  const setCategory = useSetCategory();

  if (receipts.length === 0) {
    return (
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden" }}>
        <div style={{ padding: 40, textAlign: "center", color: color.textFaint, fontSize: fontSize.body }}>
          No receipts match your search.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden" }}>
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "0.9fr 1.4fr 1.1fr 1.1fr 0.8fr 0.75fr 0.8fr 0.95fr",
          padding: "12px 20px",
          fontSize: fontSize.tiny + 0.5,
          fontWeight: fontWeight.bold,
          color: color.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          borderBottom: `1px solid ${color.borderSubtle}`,
        }}
      >
        <div>Date</div>
        <div>Vendor</div>
        <div>User</div>
        <div>Category</div>
        <div>Net amount</div>
        <div>Tax</div>
        <div>Total</div>
        <div>Reimbursement</div>
      </div>

      {receipts.map((r) => (
        <div key={r.id}>
          <div
            className="hidden sm:grid"
            style={{
              gridTemplateColumns: "0.9fr 1.4fr 1.1fr 1.1fr 0.8fr 0.75fr 0.8fr 0.95fr",
              alignItems: "center",
              padding: "13px 20px",
              borderBottom: `1px solid ${color.borderSubtle}`,
              fontSize: fontSize.body,
            }}
          >
            <button
              type="button"
              onClick={() => openReceipt(r.id)}
              style={{ cursor: "pointer", color: color.textMuted, background: "none", border: "none", textAlign: "left", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
            >
              {r.receiptDate ? formatShortDate(r.receiptDate) : "—"}
            </button>
            <button
              type="button"
              onClick={() => openReceipt(r.id)}
              style={{
                cursor: "pointer",
                fontWeight: fontWeight.bold,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: "none",
                textAlign: "left",
                padding: 0,
                color: color.text,
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            >
              <Avatar name={r.vendor ?? "?"} size={28} />
              {r.vendor}
            </button>
            <div style={{ color: color.textMuted }}>{nameOf(users, r.createdBy)}</div>
            <div>
              <select
                value={r.categoryName ?? "Other"}
                onChange={(e) => setCategory.mutate({ id: r.id, categoryName: e.target.value })}
                style={{
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.sm,
                  padding: "4px 8px",
                  fontSize: fontSize.small,
                  fontWeight: fontWeight.semibold,
                  background: categoryChipBg(r.categoryName ?? "Other"),
                  color: categoryChipText(r.categoryName ?? "Other"),
                }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ color: color.textMuted }}>
              {reclaimedNetMinor(r) !== null ? formatMoney(reclaimedNetMinor(r)!, r.currency) : "—"}
            </div>
            <div style={{ color: color.textMuted }}>
              {reclaimedTaxMinor(r) !== null ? formatMoney(reclaimedTaxMinor(r)!, r.currency) : "—"}
            </div>
            <button
              type="button"
              onClick={() => openReceipt(r.id)}
              style={{ cursor: "pointer", fontWeight: fontWeight.bold, background: "none", border: "none", textAlign: "left", padding: 0, color: color.text, fontFamily: "inherit", fontSize: "inherit" }}
            >
              {formatMoney(r.totalMinor, r.currency)}
            </button>
            <div>
              {admin ? (
                <select
                  value={r.reimbursementStatus}
                  onChange={(e) =>
                    requestReimbursementChange(r.id, r.vendor ?? "This receipt", e.target.value as ReimbursementStatus, r.rejectionReason)
                  }
                  style={{
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.sm,
                    padding: "4px 8px",
                    fontSize: fontSize.small,
                    fontWeight: fontWeight.semibold,
                    background: reimbursementChip[r.reimbursementStatus].bg,
                    color: reimbursementChip[r.reimbursementStatus].text,
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {reimbursementChip[s].label}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  style={{
                    fontSize: fontSize.small,
                    fontWeight: fontWeight.bold,
                    padding: "4px 9px",
                    borderRadius: radius.pill,
                    background: reimbursementChip[r.reimbursementStatus].bg,
                    color: reimbursementChip[r.reimbursementStatus].text,
                  }}
                >
                  {reimbursementChip[r.reimbursementStatus].label}
                </span>
              )}
            </div>
          </div>

          {/* Stacked card layout below the 640px breakpoint. */}
          <div
            className="flex sm:hidden"
            style={{ flexDirection: "column", gap: 8, padding: "13px 20px", borderBottom: `1px solid ${color.borderSubtle}`, fontSize: fontSize.body }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => openReceipt(r.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: fontWeight.bold, background: "none", border: "none", padding: 0, color: color.text, fontFamily: "inherit", fontSize: "inherit" }}
              >
                <Avatar name={r.vendor ?? "?"} size={28} />
                {r.vendor}
              </button>
              <div style={{ fontWeight: fontWeight.bold }}>{formatMoney(r.totalMinor, r.currency)}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: color.textMuted, fontSize: fontSize.small }}>
              <span>
                {r.receiptDate ? formatShortDate(r.receiptDate) : "—"} · {nameOf(users, r.createdBy)}
              </span>
              <CategoryChip category={r.categoryName ?? "Other"} />
            </div>
            {reclaimedNetMinor(r) !== null || reclaimedTaxMinor(r) !== null ? (
              <div style={{ color: color.textFaint, fontSize: fontSize.small }}>
                {reclaimedNetMinor(r) !== null ? `Net ${formatMoney(reclaimedNetMinor(r)!, r.currency)}` : null}
                {reclaimedNetMinor(r) !== null && reclaimedTaxMinor(r) !== null ? " · " : null}
                {reclaimedTaxMinor(r) !== null ? `Tax ${formatMoney(reclaimedTaxMinor(r)!, r.currency)}` : null}
              </div>
            ) : null}
            <div>
              {admin ? (
                <select
                  value={r.reimbursementStatus}
                  onChange={(e) =>
                    requestReimbursementChange(r.id, r.vendor ?? "This receipt", e.target.value as ReimbursementStatus, r.rejectionReason)
                  }
                  style={{
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.sm,
                    padding: "4px 8px",
                    fontSize: fontSize.small,
                    fontWeight: fontWeight.semibold,
                    background: reimbursementChip[r.reimbursementStatus].bg,
                    color: reimbursementChip[r.reimbursementStatus].text,
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {reimbursementChip[s].label}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  style={{
                    fontSize: fontSize.small,
                    fontWeight: fontWeight.bold,
                    padding: "4px 9px",
                    borderRadius: radius.pill,
                    background: reimbursementChip[r.reimbursementStatus].bg,
                    color: reimbursementChip[r.reimbursementStatus].text,
                  }}
                >
                  {reimbursementChip[r.reimbursementStatus].label}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Small local helpers so the inline <select> background can match the chip
// palette without re-deriving colour logic — they call straight through to
// @rr/shared's categoryChipColor.
function categoryChipBg(name: string) {
  return categoryChipColor(name, true);
}
function categoryChipText(name: string) {
  return categoryChipColor(name, false);
}
