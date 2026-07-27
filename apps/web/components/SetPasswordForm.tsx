"use client";

import { useState } from "react";
import { color, fontSize, radius } from "@rr/ui-tokens";
import { useChangePassword } from "../lib/queries";

const MIN_LENGTH = 8;

/**
 * The actual password + confirm fields and their validation, shared between
 * SetPasswordScreen (forced, for admin-provisioned accounts) and the
 * self-service /reset-password page — same underlying changePassword() call,
 * just different surrounding copy and what happens after success.
 */
export function SetPasswordForm({ submitLabel, onSuccess }: { submitLabel: string; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const changePassword = useChangePassword();

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !changePassword.isPending;

  const submit = () => {
    if (!canSubmit) return;
    changePassword.mutate(password, { onSuccess });
  };

  return (
    <>
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
        <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginBottom: 8 }}>At least {MIN_LENGTH} characters.</div>
      ) : null}
      {mismatch ? <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginBottom: 8 }}>Passwords don&rsquo;t match.</div> : null}
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
          fontWeight: 700,
          fontSize: fontSize.body,
          cursor: canSubmit ? "pointer" : "not-allowed",
          opacity: canSubmit ? 1 : 0.5,
        }}
      >
        {changePassword.isPending ? "…" : submitLabel}
      </button>
    </>
  );
}
