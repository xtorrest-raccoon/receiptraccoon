"use client";

import Link from "next/link";
import { canManageReimbursementAuthority } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { CURRENCIES } from "../../lib/data";
import { useCurrentUser, useHomeCurrency, useSetHomeCurrency, useUsers } from "../../lib/queries";
import { ProvisionMemberPanel } from "../../components/ProvisionMemberPanel";
import { InviteTeammatePanel } from "../../components/InviteTeammatePanel";
import { ReimbursementAuthorityTable } from "../../components/ReimbursementAuthorityTable";

/**
 * Everything about how this workspace is configured, in one place — account
 * creation, invites, the reimbursement approval hierarchy, and workspace-wide
 * settings. Visible only to whoever canManageReimbursementAuthority (admin/
 * owner, or a super user with both capabilities) — the same audience already
 * allowed to grant authority itself.
 */
export default function SetupPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: users } = useUsers();
  const { data: homeCurrency } = useHomeCurrency();
  const setHomeCurrency = useSetHomeCurrency();

  const allowed = currentUser ? canManageReimbursementAuthority(currentUser.role, currentUser) : false;

  if (!currentUser || !allowed) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, marginBottom: 8 }}>403 — Not authorized</div>
        <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          Setup is only visible to workspace owners/admins, or anyone granted full reimbursement authority.
          {currentUser ? ` Signed in as ${currentUser.name} (${currentUser.role}).` : ""}
        </div>
        <Link href="/dashboard" style={{ color: color.brand, fontWeight: fontWeight.bold, fontSize: fontSize.body }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!users) return null;

  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Setup</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        How this workspace is configured — accounts, invites, and who can approve or refund what.
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, maxWidth: 280 }}>
        <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
          Home currency
        </div>
        <select
          value={homeCurrency ?? "EUR"}
          onChange={(e) => setHomeCurrency.mutate(e.target.value)}
          style={{
            width: "100%",
            border: `1px solid ${color.borderStrong}`,
            borderRadius: radius.sm,
            padding: "7px 10px",
            fontSize: fontSize.small + 0.5,
            fontWeight: fontWeight.semibold,
            background: color.surface,
            color: color.text,
          }}
        >
          {CURRENCIES.map((cur) => (
            <option key={cur} value={cur}>
              {cur}
            </option>
          ))}
        </select>
        <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>
          Foreign receipts are auto-converted at scan time using the latest rate.
        </div>
      </div>

      <ProvisionMemberPanel />
      <InviteTeammatePanel />
      <ReimbursementAuthorityTable users={users} currentUser={currentUser} />
    </div>
  );
}
