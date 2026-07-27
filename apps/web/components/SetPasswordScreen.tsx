"use client";

import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { signOut } from "@rr/api";
import { SetPasswordForm } from "./SetPasswordForm";

/**
 * Blocks the whole app until an admin/owner-provisioned account sets its own
 * password — see AppShell's mustChangePassword check and
 * 0008_admin_provisioned_accounts.sql. Rendered instead of the normal
 * sidebar/content, same "full-screen replacement" shape as the login page.
 */
export function SetPasswordScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: color.bgWeb }}>
      <div style={{ width: 360, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 28 }}>
        <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginBottom: 6, textAlign: "center" }}>
          Set your password
        </div>
        <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginBottom: 20, textAlign: "center", lineHeight: 1.5 }}>
          Your account was created with a temporary password. Choose a new one to continue — you&rsquo;ll use it on both the
          web and mobile app from now on.
        </div>

        <SetPasswordForm submitLabel="Set password" onSuccess={() => {}} />

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
