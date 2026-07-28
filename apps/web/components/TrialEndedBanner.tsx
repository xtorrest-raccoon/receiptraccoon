"use client";

import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useCurrentUser, useDismissTrialEndedNotice } from "../lib/queries";

/**
 * Workspace-wide, same "everyone shares billing state" model as BillingGate
 * — shown to every member once trial_ended_early flips true (see
 * /api/billing/sync-seats going over the 5-seat trial cap), since the whole
 * workspace's billing just changed, not just the owner/admin who added the
 * seat. Only owner/admin can actually dismiss it — workspaces_update's RLS
 * policy would reject anyone else's attempt anyway.
 */
export function TrialEndedBanner() {
  const { data: currentUser } = useCurrentUser();
  const dismiss = useDismissTrialEndedNotice();

  if (!currentUser?.trialEndedEarly) return null;
  const canDismiss = currentUser.role === "owner" || currentUser.role === "admin";

  return (
    <div
      style={{
        background: color.brandTint,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
        fontSize: fontSize.small + 0.5,
      }}
    >
      <div>
        Your free trial ended early because this workspace went over the 5-seat limit — billing has started and your
        card on file has been charged.
      </div>
      {canDismiss ? (
        <button
          type="button"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          style={{
            padding: "6px 12px",
            borderRadius: radius.sm + 1,
            background: "transparent",
            color: color.text,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.small,
            border: `1px solid ${color.borderStrong}`,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Got it
        </button>
      ) : null}
    </div>
  );
}
