"use client";

import {
  canTransitionReimbursement,
  currencySymbol,
  formatMoney,
  formatShortDate,
  rateToDecimalString,
  type MileageTrip,
  type ReimbursementAuthority,
  type ReimbursementStatus,
  type Role,
} from "@rr/shared";
import { color, fontSize, fontWeight, layout, radius, reimbursementChip } from "@rr/ui-tokens";

const BACKDROP = `color-mix(in oklch, ${color.text} 45%, transparent)`;

const STATUS_ORDER: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];

/**
 * Read-only-plus-status-control detail view for a mileage trip, opened from
 * MileageTable — the same drawer pattern as ReceiptDrawer, but self-contained
 * within MileageTable rather than store-driven, since (unlike receipts)
 * trips are only ever listed in that one place today.
 */
export function MileageTripDrawer({
  trip,
  currency,
  creatorName,
  canAct,
  viewerRole,
  viewerAuthority,
  onClose,
  onRequestStatusChange,
}: {
  trip: MileageTrip;
  currency: string;
  creatorName: string;
  /** Admin/owner, or granted approve/process authority — see canAct in MileageTable. */
  canAct: boolean;
  viewerRole: Role;
  viewerAuthority: ReimbursementAuthority;
  onClose: () => void;
  onRequestStatusChange: (status: ReimbursementStatus) => void;
}) {
  return (
    <div
      onClick={onClose}
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
            <div style={{ fontSize: fontSize.xl + 1, fontWeight: fontWeight.heavy }}>{trip.purpose}</div>
            <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginTop: 2 }}>
              {formatShortDate(trip.tripDate)} · {creatorName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <div style={{ fontSize: fontSize.body, fontWeight: fontWeight.bold, marginBottom: 8 }}>Reimbursement</div>
        {canAct ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {STATUS_ORDER.map((status) => {
              const active = trip.reimbursementStatus === status;
              const meta = reimbursementChip[status];
              const enabled = canTransitionReimbursement(status, viewerRole, viewerAuthority);
              return (
                <button
                  key={status}
                  type="button"
                  disabled={!enabled}
                  onClick={() => onRequestStatusChange(status)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "8px 4px",
                    borderRadius: radius.md,
                    fontSize: fontSize.small - 0.5,
                    fontWeight: fontWeight.bold,
                    cursor: enabled ? "pointer" : "not-allowed",
                    opacity: enabled ? 1 : 0.4,
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
                background: reimbursementChip[trip.reimbursementStatus].bg,
                color: reimbursementChip[trip.reimbursementStatus].text,
              }}
            >
              {reimbursementChip[trip.reimbursementStatus].label}
            </span>
          </div>
        )}

        {trip.reimbursementStatus === "rejected" ? (
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
              {trip.rejectionReason || "No reason recorded."}
            </div>
          </div>
        ) : null}

        {trip.startAddress && trip.endAddress ? (
          <div
            style={{
              background: reimbursementChip.approved.bg,
              borderRadius: radius.lg,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: fontSize.tiny, fontWeight: fontWeight.bold, color: reimbursementChip.approved.text, marginBottom: 4 }}>
              Calculated from addresses
            </div>
            <div style={{ fontSize: fontSize.small + 0.5, color: reimbursementChip.approved.text, lineHeight: 1.5 }}>
              {trip.startAddress} → {trip.endAddress}
            </div>
          </div>
        ) : null}

        <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: color.textMuted, fontSize: fontSize.body }}>
            <span>Distance</span>
            <span>
              {trip.distance.toFixed(1)} {trip.distanceUnit}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: color.textMuted, fontSize: fontSize.body }}>
            <span>Rate</span>
            <span>
              {currencySymbol(currency)}
              {rateToDecimalString(trip.rateMilli)} per {trip.distanceUnit}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: fontWeight.heavy,
              fontSize: fontSize.lg,
              paddingTop: 6,
              borderTop: `1px solid ${color.border}`,
            }}
          >
            <span>{trip.reimbursementStatus === "reimbursed" ? "Reimbursed" : "Reimbursement"}</span>
            <span>{formatMoney(trip.amountMinor, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
