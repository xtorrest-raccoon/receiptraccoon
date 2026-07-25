"use client";

import { useEffect, useState } from "react";
import {
  canEditReceiptAmount,
  formatMoney,
  formatPaymentMethod,
  formatShortDate,
  isAdmin,
  minorToDecimalString,
  parseMoneyToMinor,
  reclaimMinor,
  reclaimedTaxMinor,
  taxRate,
  type ReimbursementStatus,
} from "@rr/shared";
import { color, fontSize, fontWeight, layout, radius, reimbursementChip } from "@rr/ui-tokens";
import { useCurrentUser, useReceipt, useReceiptPhotoUrl, useSetReceiptReclaim, useUsers } from "../lib/queries";
import { useDataStore } from "../lib/store";
import { CategoryChip, ReceiptStatusChip } from "./Chips";

const BACKDROP = `color-mix(in oklch, ${color.text} 45%, transparent)`;

const STATUS_ORDER: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];

export function ReceiptDrawer() {
  const { selectedReceiptId, closeReceipt, requestReimbursementChange } = useDataStore();
  const { data: receipt } = useReceipt(selectedReceiptId);
  const { data: currentUser } = useCurrentUser();
  const { data: users } = useUsers();
  const { data: photoUrl } = useReceiptPhotoUrl(receipt?.imagePath ?? null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const setReceiptReclaim = useSetReceiptReclaim();
  const [reclaimText, setReclaimText] = useState("");

  useEffect(() => {
    setReclaimText(receipt ? minorToDecimalString(reclaimMinor(receipt), receipt.currency) : "");
  }, [receipt]);

  if (!selectedReceiptId || !receipt || !currentUser || !users) return null;

  const admin = isAdmin(currentUser.role);
  const creatorName = users.find((u) => u.id === receipt.createdBy)?.name ?? "Unknown";
  const paymentMethod = formatPaymentMethod(receipt.paymentBrand, receipt.paymentLast4);
  const amountEditable = canEditReceiptAmount(receipt.reimbursementStatus);
  const typedReclaim = parseMoneyToMinor(reclaimText, receipt.currency);
  const reclaimExceedsTotal = typedReclaim !== null && typedReclaim > receipt.totalMinor;

  const commitReclaim = (value: string) => {
    setReclaimText(value);
    const minor = parseMoneyToMinor(value, receipt.currency);
    // Reject a claim above the total rather than storing it — the database has
    // the same constraint, so accepting it here would only fail later at the API.
    if (minor !== null && minor >= 0 && minor <= receipt.totalMinor) {
      setReceiptReclaim.mutate({ id: receipt.id, minor });
    }
  };

  return (
    <div
      onClick={closeReceipt}
      style={{ position: "fixed", inset: 0, background: BACKDROP, zIndex: 20, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: layout.drawerWidth,
          maxWidth: "92vw",
          height: "100%",
          background: color.surface,
          overflowY: "auto",
          padding: 26,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: fontSize.xl + 1, fontWeight: fontWeight.heavy }}>{receipt.vendor}</div>
            <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginTop: 2 }}>
              {receipt.receiptDate ? formatShortDate(receipt.receiptDate) : "—"}
              {paymentMethod ? ` · ${paymentMethod}` : ""} · {creatorName}
            </div>
          </div>
          <button
            type="button"
            onClick={closeReceipt}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: radius.sm + 1,
              background: color.surfaceMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: fontSize.lg + 1,
              color: color.textMuted,
              border: "none",
            }}
          >
            ×
          </button>
        </div>

        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed
          // URL is a one-hour-lived opaque token, not a stable asset
          // next/image's optimizer/CDN caching would want to hold onto.
          <img
            src={photoUrl}
            alt={`Receipt from ${receipt.vendor ?? "unknown vendor"}`}
            onClick={() => setPhotoViewerOpen(true)}
            style={{
              width: "100%",
              height: 200,
              objectFit: "cover",
              borderRadius: radius.xl,
              marginBottom: 18,
              border: `1px solid ${color.border}`,
              cursor: "zoom-in",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: 200,
              borderRadius: radius.xl,
              marginBottom: 18,
              background: `repeating-linear-gradient(135deg, ${color.borderSubtle}, ${color.borderSubtle} 10px, ${color.surfaceMuted} 10px, ${color.surfaceMuted} 20px)`,
              border: `1px solid ${color.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color.textFaint,
              fontFamily: "monospace",
              fontSize: fontSize.small,
            }}
          >
            [ receipt photo ]
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <CategoryChip category={receipt.categoryName ?? "Other"} />
          <ReceiptStatusChip status={receipt.status} />
        </div>

        <div style={{ fontSize: fontSize.body, fontWeight: fontWeight.bold, marginBottom: 8 }}>Reimbursement</div>
        {admin ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {STATUS_ORDER.map((status) => {
              const active = receipt.reimbursementStatus === status;
              const meta = reimbursementChip[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    requestReimbursementChange(receipt.id, receipt.vendor ?? "This receipt", status, receipt.rejectionReason)
                  }
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "8px 4px",
                    borderRadius: radius.md,
                    fontSize: fontSize.small - 0.5,
                    fontWeight: fontWeight.bold,
                    cursor: "pointer",
                    background: active ? meta.bg : color.surfaceMuted,
                    color: active ? meta.text : color.textFaint,
                    border: "none",
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <span
              style={{
                fontSize: fontSize.small - 0.5,
                fontWeight: fontWeight.bold,
                padding: "4px 10px",
                borderRadius: radius.pill,
                background: reimbursementChip[receipt.reimbursementStatus].bg,
                color: reimbursementChip[receipt.reimbursementStatus].text,
              }}
            >
              {reimbursementChip[receipt.reimbursementStatus].label}
            </span>
          </div>
        )}

        {receipt.reimbursementStatus === "rejected" ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: fontSize.small - 0.5, fontWeight: fontWeight.bold, color: color.textMuted, marginBottom: 6 }}>
              Reason for rejection
            </div>
            <div
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${color.borderStrong}`,
                fontSize: fontSize.body,
                lineHeight: 1.5,
                color: color.text,
                background: color.surfaceMuted,
                minHeight: 44,
              }}
            >
              {receipt.rejectionReason || "No reason recorded."}
            </div>
          </div>
        ) : null}

        {receipt.originalCurrency && receipt.originalTotalMinor != null && receipt.fxRate != null ? (
          <div
            style={{
              background: reimbursementChip.approved.bg,
              borderRadius: radius.lg,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: fontSize.tiny, fontWeight: fontWeight.bold, color: reimbursementChip.approved.text, marginBottom: 4 }}>
              Currency conversion
            </div>
            <div style={{ fontSize: fontSize.small + 0.5, color: reimbursementChip.approved.text, lineHeight: 1.5 }}>
              Originally {formatMoney(receipt.originalTotalMinor, receipt.originalCurrency)} · converted at {receipt.fxRate} on{" "}
              {receipt.fxRateDate ? formatShortDate(receipt.fxRateDate) : "—"}
            </div>
          </div>
        ) : null}

        {receipt.comment ? (
          <div style={{ background: color.surfaceMuted, borderRadius: radius.lg, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: fontSize.tiny, fontWeight: fontWeight.bold, color: color.textMuted, marginBottom: 4 }}>Comment</div>
            <div style={{ fontSize: fontSize.small + 0.5, color: color.text, lineHeight: 1.5 }}>{receipt.comment}</div>
          </div>
        ) : null}

        <div style={{ fontSize: fontSize.body, fontWeight: fontWeight.bold, marginBottom: 10 }}>Line items</div>
        <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.lg, overflow: "hidden", marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.6fr 1fr 1fr",
              padding: "9px 14px",
              fontSize: fontSize.tiny,
              fontWeight: fontWeight.bold,
              color: color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              background: color.surfaceMuted,
            }}
          >
            <div>Description</div>
            <div>Qty</div>
            <div>Unit</div>
            <div>Amount</div>
          </div>
          {receipt.lineItems.map((li) => (
            <div
              key={li.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.6fr 1fr 1fr",
                padding: "9px 14px",
                fontSize: fontSize.small + 0.5,
                borderTop: `1px solid ${color.borderSubtle}`,
              }}
            >
              <div>{li.description}</div>
              <div>{li.quantity}</div>
              <div>{formatMoney(li.unitPriceMinor, receipt.currency)}</div>
              <div style={{ fontWeight: fontWeight.semibold }}>{formatMoney(li.amountMinor, receipt.currency)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: fontSize.body }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: color.textMuted }}>
            <span>Subtotal</span>
            <span>{receipt.subtotalMinor !== null ? formatMoney(receipt.subtotalMinor, receipt.currency) : "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: color.textMuted }}>
            <span>
              Tax
              {taxRate(receipt) !== null ? (
                <span style={{ color: color.textFaint }}> ({(taxRate(receipt)! * 100).toFixed(1)}%)</span>
              ) : null}
            </span>
            <span>{reclaimedTaxMinor(receipt) !== null ? formatMoney(reclaimedTaxMinor(receipt)!, receipt.currency) : "—"}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: fontWeight.heavy,
              fontSize: fontSize.lg,
              paddingTop: 6,
              borderTop: `1px solid ${color.border}`,
            }}
          >
            <span>Total</span>
            <span>{formatMoney(receipt.totalMinor, receipt.currency)}</span>
          </div>

          {/* What is actually being claimed. Defaults to the total; lower it for a
              shared bill or a personal portion — this is the figure spend reporting
              and reimbursement read, and the Tax row above scales with it. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
            {/* Past tense once the money has actually been paid out — "to reclaim"
                reads as still outstanding, which it no longer is. */}
            <span style={{ fontWeight: fontWeight.bold }}>
              {receipt.reimbursementStatus === "reimbursed" ? "Amount reclaimed" : "Amount to reclaim"}
            </span>
            {amountEditable ? (
              <input
                value={reclaimText}
                onChange={(e) => commitReclaim(e.target.value)}
                style={{
                  width: 90,
                  textAlign: "right",
                  padding: "5px 8px",
                  borderRadius: radius.sm,
                  border: `1px solid ${reclaimExceedsTotal ? color.up : color.borderStrong}`,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.bold,
                }}
              />
            ) : (
              <span style={{ fontWeight: fontWeight.bold }}>{formatMoney(reclaimMinor(receipt), receipt.currency)}</span>
            )}
          </div>
          {reclaimExceedsTotal ? (
            <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, textAlign: "right" }}>
              Cannot reclaim more than the receipt total.
            </div>
          ) : null}
        </div>
      </div>

      {photoViewerOpen && photoUrl ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setPhotoViewerOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- same signed-URL reasoning as the thumbnail above */}
          <img
            src={photoUrl}
            alt={`Receipt from ${receipt.vendor ?? "unknown vendor"}`}
            style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain", borderRadius: radius.md }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPhotoViewerOpen(false);
            }}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              background: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: fontSize.lg + 1,
              color: "#fff",
              border: "none",
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
