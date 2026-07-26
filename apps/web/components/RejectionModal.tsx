"use client";

import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import { useDataStore } from "../lib/store";

/**
 * The design's modal/drawer backdrops use an alpha-blended oklch the tokens
 * package has no equivalent for (there is no "overlay" entry in `color`).
 * color-mix keeps this token-sourced rather than inventing a new literal.
 */
const BACKDROP = `color-mix(in oklch, ${color.text} 45%, transparent)`;

export function RejectionModal() {
  const { rejectionModal, setRejectionReason, confirmRejection, cancelRejection } = useDataStore();
  if (!rejectionModal) return null;

  const canConfirm = rejectionModal.reason.trim().length > 0;

  return (
    <div
      onClick={cancelRejection}
      style={{
        position: "fixed",
        inset: 0,
        background: BACKDROP,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: "90vw", background: color.surface, borderRadius: radius["2xl"], padding: 24 }}
      >
        <div style={{ fontSize: fontSize.lg + 1, fontWeight: fontWeight.heavy, marginBottom: 4 }}>
          {rejectionModal.entityType === "mileage_trip" ? "Reject mileage trip" : "Reject receipt"}
        </div>
        <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginBottom: 16 }}>
          {rejectionModal.label} — this reason will be visible to the employee.
        </div>
        <textarea
          value={rejectionModal.reason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder={`Explain why this ${rejectionModal.entityType === "mileage_trip" ? "trip" : "receipt"} was rejected…`}
          style={{
            width: "100%",
            minHeight: 90,
            padding: "10px 12px",
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            fontSize: fontSize.body,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={cancelRejection}
            style={{
              flex: 1,
              textAlign: "center",
              padding: 10,
              borderRadius: radius.md,
              background: color.surfaceMuted,
              color: color.textMuted,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={canConfirm ? confirmRejection : undefined}
            disabled={!canConfirm}
            style={{
              flex: 1,
              textAlign: "center",
              padding: 10,
              borderRadius: radius.md,
              background: reimbursementChip.rejected.text,
              color: color.surface,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              border: "none",
              cursor: canConfirm ? "pointer" : "not-allowed",
              opacity: canConfirm ? 1 : 0.5,
            }}
          >
            {rejectionModal.entityType === "mileage_trip" ? "Reject trip" : "Reject receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
