"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "@rr/api";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { getCurrentUser } from "../lib/data";
import { useCreateCheckoutSession } from "../lib/queries";

const STATUS_COPY: Record<string, string> = {
  inactive: "This workspace hasn't been activated yet.",
  past_due: "This workspace's last payment failed.",
  canceled: "This workspace's subscription has been canceled.",
};

/**
 * Blocks the whole app for every member of a workspace whose billing isn't
 * active — "no payment, no scan" is workspace-wide, not per-seat, per the
 * agreed model: everyone loses access together, only the owner can fix it.
 *
 * Polls currentUser while gated so it self-heals within a few seconds of a
 * successful checkout — the webhook (not this component) is what actually
 * flips billing_status, asynchronously, after Stripe confirms payment.
 */
export function BillingGate({ children }: { children: ReactNode }) {
  // Shares the "currentUser" cache entry with useCurrentUser() elsewhere —
  // same queryKey, just with polling layered on for this one observer while
  // gated, so this component alone stays responsive to the webhook without
  // making every other screen poll too.
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    refetchInterval: (query) => (query.state.data?.billingStatus === "active" ? false : 3000),
  });
  const createCheckoutSession = useCreateCheckoutSession();

  if (!currentUser || currentUser.billingStatus === "active") return <>{children}</>;

  const canManageBilling = currentUser.role === "owner" || currentUser.role === "admin";

  const subscribe = () => {
    createCheckoutSession.mutate(undefined, {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
    });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: color.bgWeb }}>
      <div style={{ width: 380, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginBottom: 8 }}>
          {canManageBilling ? "Activate your workspace" : "Workspace unavailable"}
        </div>
        <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
          {STATUS_COPY[currentUser.billingStatus] ?? "This workspace's billing needs attention."}{" "}
          {canManageBilling ? "Subscribe to continue." : "Ask your workspace owner or admin to resolve it."}
        </div>

        {canManageBilling ? (
          <button
            type="button"
            onClick={subscribe}
            disabled={createCheckoutSession.isPending}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: radius.md,
              border: "none",
              background: color.brand,
              color: "#fff",
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              cursor: createCheckoutSession.isPending ? "not-allowed" : "pointer",
              opacity: createCheckoutSession.isPending ? 0.6 : 1,
            }}
          >
            {createCheckoutSession.isPending ? "…" : "Subscribe"}
          </button>
        ) : null}
        {createCheckoutSession.isError ? (
          <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginTop: 10 }}>
            {createCheckoutSession.error instanceof Error ? createCheckoutSession.error.message : "Couldn't start checkout."}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => signOut()}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "6px 0",
            border: "none",
            background: "none",
            color: color.textFaint,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.small,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
