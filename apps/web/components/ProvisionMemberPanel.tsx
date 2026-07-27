"use client";

import { useState } from "react";
import type { Role } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useProvisionMember } from "../lib/queries";

const ROLES: Role[] = ["member", "admin"];

/**
 * Creates an account directly, with a one-time temporary password to relay
 * to that person — for anyone who'll never self-register (see the mobile
 * app's sign-in-only login screen). Distinct from InviteTeammatePanel, which
 * is for someone who already has (or will make) their own account elsewhere.
 */
export function ProvisionMemberPanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [result, setResult] = useState<{ email: string; tempPassword: string; emailSent: boolean } | null>(null);
  const provisionMember = useProvisionMember();

  const create = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    provisionMember.mutate(
      { email: trimmed, role },
      {
        onSuccess: (res) => {
          setResult(res);
          setEmail("");
        },
      },
    );
  };

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 }}>Create an account</div>
      <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>
        For someone who won&rsquo;t sign themselves up. They&rsquo;ll get a welcome email with a sign-in link — you still
        relay the one-time temporary password yourself; they choose their own on first sign-in.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
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
          onClick={create}
          disabled={provisionMember.isPending}
          style={{
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            border: "none",
            cursor: "pointer",
            opacity: provisionMember.isPending ? 0.6 : 1,
          }}
        >
          Create
        </button>
      </div>
      {provisionMember.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginBottom: 10 }}>
          {provisionMember.error instanceof Error ? provisionMember.error.message : "Couldn't create that account."}
        </div>
      ) : null}
      {result ? (
        <div style={{ background: color.brandTint, borderRadius: radius.lg, padding: "14px 16px" }}>
          <div style={{ fontSize: fontSize.small, fontWeight: fontWeight.bold, marginBottom: 6 }}>
            Account created for {result.email}
          </div>
          <div style={{ fontSize: fontSize.small, color: result.emailSent ? color.textMuted : color.up, marginBottom: 8 }}>
            {result.emailSent
              ? "Welcome email sent with a sign-in link."
              : "Couldn't send the welcome email — let them know to sign in themselves."}
          </div>
          <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 8 }}>
            Temporary password — shown once, copy it now and relay it to them yourself:
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              padding: "8px 12px",
              borderRadius: radius.sm,
              background: color.surface,
              display: "inline-block",
            }}
          >
            {result.tempPassword}
          </div>
        </div>
      ) : null}
    </div>
  );
}
