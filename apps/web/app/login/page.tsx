"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { signInWithPassword, signUp } from "@rr/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signUp") {
        const { session } = await signUp(email.trim(), password, name.trim() || undefined);
        // With email confirmation on (Supabase's default), signUp succeeds but
        // returns no session — redirecting anyway bounced straight back here
        // via AppShell's own "no session -> /login" redirect, silently
        // resetting the form with zero explanation of what actually happened.
        if (!session) {
          setConfirmPending(true);
          return;
        }
      } else {
        await signInWithPassword(email.trim(), password);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (confirmPending) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color.bgWeb,
        }}
      >
        <div
          style={{
            width: 340,
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius["2xl"],
            padding: 28,
            textAlign: "center",
          }}
        >
          <Image src="/logo.png" alt="ReceiptRaccoon" width={88} height={88} style={{ marginBottom: 14 }} />
          <div style={{ fontSize: fontSize.body, color: color.text, lineHeight: 1.5 }}>
            Check <strong>{email.trim()}</strong> for a confirmation link, then sign in.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: color.bgWeb,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 340,
          background: color.surface,
          border: `1px solid ${color.border}`,
          borderRadius: radius["2xl"],
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Image src="/logo.png" alt="ReceiptRaccoon" width={72} height={72} style={{ alignSelf: "center", marginBottom: 4 }} />
        <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 8, textAlign: "center" }}>
          {mode === "signUp" ? "Create your workspace" : "Sign in"}
        </div>

        {mode === "signUp" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          autoComplete="email"
          style={inputStyle}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          style={inputStyle}
        />

        {error && <div style={{ fontSize: fontSize.small, color: color.up }}>{error}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
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
          {busy ? "…" : mode === "signUp" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signUp" ? "signIn" : "signUp")}
          style={{
            marginTop: 4,
            padding: "6px 0",
            border: "none",
            background: "none",
            color: color.brand,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.small,
            cursor: "pointer",
          }}
        >
          {mode === "signUp" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.sm,
  padding: "10px 12px",
  fontSize: fontSize.body,
  color: color.text,
  background: color.surface,
};
