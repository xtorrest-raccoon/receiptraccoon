"use client";

import { useState } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import type { CurrentUser } from "../lib/data";
import { useCancelSubscription, useCreatePortalSession, useResumeSubscription } from "../lib/queries";

/**
 * The initial card entry happens on BillingGate's blocking screen (a
 * brand-new workspace has nothing to manage here yet) — this panel is for
 * everything after that: seeing the trial countdown, updating the card on
 * file via Stripe's own Billing Portal, and canceling.
 */
export function PaymentSetupPanel({ currentUser }: { currentUser: CurrentUser }) {
  const createPortalSession = useCreatePortalSession();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();
  const [confirming, setConfirming] = useState(false);

  const trialEndsAt = currentUser.trialEndsAt ? new Date(currentUser.trialEndsAt) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000)) : null;
  const inTrial = daysLeft !== null;
  const periodEnd = currentUser.currentPeriodEnd ? new Date(currentUser.currentPeriodEnd) : null;

  const openPortal = () => {
    createPortalSession.mutate(undefined, {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
    });
  };

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 }}>Payment method</div>

      {currentUser.cancelAtPeriodEnd ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginBottom: 14, lineHeight: 1.5 }}>
          Your subscription is set to cancel{periodEnd ? ` on ${periodEnd.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}` : ""}. You'll
          keep access until then — no further charges after that.
        </div>
      ) : (
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>
          {inTrial
            ? `Free trial — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left, up to 5 seats included. Your card is on file and will be charged automatically once the trial ends.`
            : "Billed monthly, per seat — the total adjusts automatically as people are added or removed."}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={openPortal}
          disabled={createPortalSession.isPending}
          style={{
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            border: "none",
            cursor: "pointer",
            opacity: createPortalSession.isPending ? 0.6 : 1,
          }}
        >
          {createPortalSession.isPending ? "…" : "Manage payment method"}
        </button>

        {currentUser.cancelAtPeriodEnd ? (
          <button
            type="button"
            onClick={() => resumeSubscription.mutate()}
            disabled={resumeSubscription.isPending}
            style={{
              padding: "9px 16px",
              borderRadius: radius.md,
              background: "transparent",
              color: color.text,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              border: `1px solid ${color.borderStrong}`,
              cursor: "pointer",
              opacity: resumeSubscription.isPending ? 0.6 : 1,
            }}
          >
            {resumeSubscription.isPending ? "…" : "Resume subscription"}
          </button>
        ) : !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              padding: "9px 16px",
              borderRadius: radius.md,
              background: "transparent",
              color: color.up,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              border: `1px solid ${color.borderStrong}`,
              cursor: "pointer",
            }}
          >
            Cancel subscription
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: fontSize.small, color: color.textMuted }}>
              {inTrial ? "Cancel now and lose access immediately?" : "Cancel and stop at the end of the current billing period?"}
            </span>
            <button
              type="button"
              onClick={() => cancelSubscription.mutate(undefined, { onSuccess: () => setConfirming(false) })}
              disabled={cancelSubscription.isPending}
              style={{
                padding: "7px 14px",
                borderRadius: radius.md,
                background: color.up,
                color: "#fff",
                fontWeight: fontWeight.bold,
                fontSize: fontSize.small,
                border: "none",
                cursor: "pointer",
                opacity: cancelSubscription.isPending ? 0.6 : 1,
              }}
            >
              {cancelSubscription.isPending ? "…" : "Yes, cancel"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                padding: "7px 14px",
                borderRadius: radius.md,
                background: "transparent",
                color: color.textMuted,
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.small,
                border: `1px solid ${color.borderStrong}`,
                cursor: "pointer",
              }}
            >
              Never mind
            </button>
          </div>
        )}
      </div>

      {createPortalSession.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginTop: 10 }}>
          {createPortalSession.error instanceof Error ? createPortalSession.error.message : "Couldn't open the billing portal."}
        </div>
      ) : null}
      {cancelSubscription.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginTop: 10 }}>
          {cancelSubscription.error instanceof Error ? cancelSubscription.error.message : "Couldn't cancel the subscription."}
        </div>
      ) : null}
      {resumeSubscription.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginTop: 10 }}>
          {resumeSubscription.error instanceof Error ? resumeSubscription.error.message : "Couldn't resume the subscription."}
        </div>
      ) : null}
    </div>
  );
}
