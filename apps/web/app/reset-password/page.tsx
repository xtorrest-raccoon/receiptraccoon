"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@rr/api";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { SetPasswordForm } from "../../components/SetPasswordForm";

/**
 * Reached via the "reset your password" email link. Supabase briefly has no
 * session while it processes the recovery token from the URL, then a
 * temporary recovery session once it has — checked once on mount rather than
 * gating render on it, since a slow network could otherwise flash the
 * "expired link" message before the token finishes processing.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let attempts = 0;
    const check = () => {
      getSession().then((session) => {
        if (session) {
          setHasSession(true);
        } else if (attempts++ < 5) {
          setTimeout(check, 400);
        } else {
          setHasSession(false);
        }
      });
    };
    check();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: color.bgWeb }}>
      <div style={{ width: 360, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 28 }}>
        <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginBottom: 6, textAlign: "center" }}>
          Reset your password
        </div>

        {hasSession === null ? (
          <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, textAlign: "center" }}>Verifying your link…</div>
        ) : hasSession ? (
          <>
            <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginBottom: 20, textAlign: "center", lineHeight: 1.5 }}>
              Choose a new password — you&rsquo;ll use it on both the web and mobile app from now on.
            </div>
            <SetPasswordForm submitLabel="Reset password" onSuccess={() => router.replace("/dashboard")} />
          </>
        ) : (
          <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, textAlign: "center", lineHeight: 1.5 }}>
            This link has expired or is invalid. Go back to{" "}
            <a href="/login" style={{ color: color.brand, fontWeight: fontWeight.bold }}>
              sign in
            </a>{" "}
            and request a new one.
          </div>
        )}
      </div>
    </div>
  );
}
