"use client";

import { useState } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { signOut } from "@rr/api";
import { useChangePassword } from "../lib/queries";

const MIN_LENGTH = 8;

/**
 * Blocks the whole app until an admin/owner-provisioned account sets its own
 * password — see AppShell's mustChangePassword check and
 * 0008_admin_provisioned_accounts.sql. Rendered instead of the normal
 * sidebar/content, same "full-screen replacement" shape as the login page.
 */
export function SetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const changePassword = useChangePassword();

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !changePassword.isPending;

  const submit = () => {
    if (!canSubmit) return;
    changePassword.mutate(password);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: color.bgWeb }}>
      <div
        style={{
          width: 360,
          background: color.surface,
          border: `1px solid ${color.border}`,
          borderRadius: radius["2xl"],
          padding: 28,
        }}
      >
        <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginBottom: 6, textAlign: "center" }}>
          Set your password
        </div>
        <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginBottom: 20, textAlign: "center", lineHeight: 1.5 }}>
          Your account was created with a temporary password. Choose a new one to continue — you&rsquo;ll use it on both the
          web and mobile app from now on.
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          autoComplete="new-password"
          style={{
            width: "100%",
            border: `1px solid ${tooShort ? color.up : color.borderStrong}`,
            borderRadius: radius.sm,
            padding: "10px 12px",
            fontSize: fontSize.body,
            marginBottom: 10,
          }}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          style={{
            width: "100%",
            border: `1px solid ${mismatch ? color.up : color.borderStrong}`,
            borderRadius: radius.sm,
            padding: "10px 12px",
            fontSize: fontSize.body,
            marginBottom: 10,
          }}
        />

        {tooShort ? (
          <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginBottom: 8 }}>
            At least {MIN_LENGTH} characters.
          </div>
        ) : null}
        {mismatch ? (
          <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginBottom: 8 }}>Passwords don&rsquo;t match.</div>
        ) : null}
        {changePassword.isError ? (
          <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginBottom: 8 }}>
            {changePassword.error instanceof Error ? changePassword.error.message : "Couldn't set that password."}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "12px 0",
            borderRadius: radius.md,
            border: "none",
            background: color.brand,
            color: "#fff",
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {changePassword.isPending ? "…" : "Set password"}
        </button>

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
