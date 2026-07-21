"use client";

import { formatMoney, formatPaymentMethod, formatShortDate, isAdmin, type ReimbursementStatus } from "@rr/shared";
import { color, fontSize, fontWeight, layout, radius, reimbursementChip } from "@rr/ui-tokens";
import { useCurrentUser, useReceipt, useReceiptPhotoUrl, useUsers } from "../lib/queries";
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

  if (!selectedReceiptId || !receipt || !currentUser || !users) return null;

  const admin = isAdmin(currentUser.role);
  const creatorName = users.find((u) => u.id === receipt.createdBy)?.name ?? "Unknown";
  const paymentMethod = formatPaymentMethod(receipt.paymentBrand, receipt.paymentLast4);

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
            style={{
              width: "100%",
              height: 200,
              objectFit: "cover",
              borderRadius: radius.xl,
              marginBottom: 18,
              border: `1px solid ${color.border}`,
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
            <span>{formatMoney(receipt.subtotalMinor ?? 0, receipt.currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: color.textMuted }}>
            <span>Tax</span>
            <span>{formatMoney(receipt.taxMinor ?? 0, receipt.currency)}</span>
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
        </div>
      </div>
    </div>
  );
}
