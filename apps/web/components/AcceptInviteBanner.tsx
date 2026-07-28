"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { syncSeats } from "../lib/data";
import { useAcceptInvite, useMyPendingInvite } from "../lib/queries";

/**
 * Shown wherever the app already checks the session (AppShell), for as long
 * as the signed-in user has a pending invite. "Not now" only hides it for
 * this app session — the invite itself stays pending and this reappears next
 * time, since there's no dismiss-forever state to track.
 */
export function AcceptInviteBanner() {
  const router = useRouter();
  const { data: invite } = useMyPendingInvite();
  const acceptInvite = useAcceptInvite();
  const [dismissed, setDismissed] = useState(false);

  if (!invite || dismissed) return null;

  return (
    <div
      style={{
        background: color.inkPanel,
        color: color.surface,
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
        You&rsquo;ve been invited to join <strong>{invite.workspaceName}</strong> as {invite.role}. Your own receipts
        and mileage will move with you.
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            padding: "6px 12px",
            borderRadius: radius.sm + 1,
            background: "transparent",
            color: color.surface,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.small,
            border: `1px solid ${color.borderStrong}`,
            cursor: "pointer",
          }}
        >
          Not now
        </button>
        <button
          type="button"
          disabled={acceptInvite.isPending}
          onClick={() =>
            acceptInvite.mutate(invite.id, {
              onSuccess: () => {
                syncSeats();
                router.replace("/dashboard");
              },
            })
          }
          style={{
            padding: "6px 14px",
            borderRadius: radius.sm + 1,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.small,
            border: "none",
            cursor: "pointer",
            opacity: acceptInvite.isPending ? 0.6 : 1,
          }}
        >
          Accept
        </button>
      </div>
      {acceptInvite.isError ? (
        <div style={{ width: "100%", fontSize: fontSize.tiny + 0.5, color: color.up }}>
          Couldn&rsquo;t accept that invite — try again.
        </div>
      ) : null}
    </div>
  );
}
