"use client";

import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useDataStore } from "../lib/store";

/**
 * The only place a rejected status change (e.g. the self-approval-blocked-
 * by-assigned-approver trigger) is ever surfaced — without this, the
 * dropdown just silently reverts with no explanation. See store.tsx's
 * statusChangeError.
 */
export function StatusChangeErrorBanner() {
  const { statusChangeError, dismissStatusChangeError } = useDataStore();

  if (!statusChangeError) return null;

  return (
    <div
      style={{
        background: color.up,
        color: "#fff",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
        fontSize: fontSize.small + 0.5,
      }}
    >
      <div style={{ fontWeight: fontWeight.semibold }}>{statusChangeError}</div>
      <button
        type="button"
        onClick={dismissStatusChangeError}
        style={{
          padding: "6px 12px",
          borderRadius: radius.sm + 1,
          background: "transparent",
          color: "#fff",
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.small,
          border: "1px solid rgba(255,255,255,0.5)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
