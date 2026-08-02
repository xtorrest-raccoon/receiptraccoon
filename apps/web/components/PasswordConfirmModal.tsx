"use client";

import { useState } from "react";
import { getSession, signInWithPassword } from "@rr/api";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";

/**
 * Requires the ACTOR's own password before a sensitive action -- a plain
 * confirm() dialog is too easy to click through. Verifies by attempting
 * signInWithPassword against the actor's own email; Supabase has no
 * separate "check this password" call, but re-authenticating as yourself
 * is harmless and is the standard way to do this client-side. Same pattern
 * as ReimbursementAuthorityTable's RemoveMemberModal, generalized so
 * rename/delete-workspace can reuse it instead of a third copy.
 */
export function PasswordConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirmed,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  /** Red confirm button for destructive actions (delete) vs. brand color for routine ones (rename). */
  danger?: boolean;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await getSession();
      if (!session?.user.email) throw new Error("Not signed in");
      await signInWithPassword(session.user.email, password);
      onConfirmed();
    } catch {
      setError("Incorrect password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "color-mix(in oklch, black 45%, transparent)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 360, background: color.surface, borderRadius: radius["2xl"], padding: 24 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 16, lineHeight: 1.5 }}>{description}</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
          }}
          style={{
            width: "100%",
            border: `1px solid ${error ? color.up : color.borderStrong}`,
            borderRadius: radius.sm,
            padding: "9px 12px",
            fontSize: fontSize.body,
            marginBottom: 8,
          }}
        />
        {error ? <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginBottom: 8 }}>{error}</div> : null}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ flex: 1, padding: "9px 0", borderRadius: radius.md, border: "none", background: color.surfaceMuted, color: color.textMuted, fontWeight: fontWeight.bold, fontSize: fontSize.body, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!password || busy}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: radius.md,
              border: "none",
              background: danger ? color.up : color.brand,
              color: "#fff",
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              cursor: !password || busy ? "not-allowed" : "pointer",
              opacity: !password || busy ? 0.6 : 1,
            }}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
