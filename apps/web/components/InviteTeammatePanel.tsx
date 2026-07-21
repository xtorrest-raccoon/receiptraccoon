"use client";

import { useState } from "react";
import type { Role } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useInviteTeammate, useRevokeInvite, useWorkspaceInvites } from "../lib/queries";

const ROLES: Role[] = ["member", "admin", "owner"];

export function InviteTeammatePanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const { data: invites } = useWorkspaceInvites();
  const inviteTeammate = useInviteTeammate();
  const revokeInvite = useRevokeInvite();

  const send = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    inviteTeammate.mutate({ email: trimmed, role });
    setEmail("");
  };

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 }}>Invite a teammate</div>
      <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>
        They&rsquo;ll be prompted to join this workspace next time they sign in — their own receipts and mileage move with them.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          style={{
            flex: 1,
            minWidth: 200,
            maxWidth: 280,
            padding: "9px 14px",
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            fontSize: fontSize.body,
          }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={{
            padding: "9px 10px",
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            fontSize: fontSize.body,
            background: color.surface,
            color: color.text,
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={send}
          disabled={inviteTeammate.isPending}
          style={{
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            border: "none",
            cursor: "pointer",
            opacity: inviteTeammate.isPending ? 0.6 : 1,
          }}
        >
          Invite
        </button>
      </div>
      {inviteTeammate.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginBottom: 10 }}>
          Couldn&rsquo;t send that invite — check the email and try again.
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(invites ?? []).map((invite) => (
          <div
            key={invite.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 12px",
              borderRadius: radius.md,
              background: color.surfaceMuted,
            }}
          >
            <div style={{ fontSize: fontSize.small + 0.5, fontWeight: fontWeight.semibold }}>
              {invite.email} <span style={{ color: color.textMuted, fontWeight: fontWeight.regular }}>· {invite.role} · pending</span>
            </div>
            <button
              type="button"
              onClick={() => revokeInvite.mutate(invite.id)}
              style={{
                fontSize: fontSize.tiny + 0.5,
                fontWeight: fontWeight.bold,
                color: color.textMuted,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
