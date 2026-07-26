"use client";

import type { CurrentUser, WorkspaceUser } from "@rr/api";
import { isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useSetReimbursementAuthority } from "../lib/queries";
import { Avatar } from "./Avatar";

/**
 * Who can approve/reject vs. refund, at a glance — separated out from
 * TeamMembersTable (which is spend analytics, a different concern) so this
 * is the one place an admin manages the whole approval hierarchy, rather
 * than a column buried in a denser table.
 */
export function ReimbursementAuthorityTable({
  users,
  currentUser,
}: {
  users: WorkspaceUser[];
  currentUser: CurrentUser;
}) {
  const setAuthority = useSetReimbursementAuthority();
  // Mirrors can_grant_reimbursement_authority() in 0007_reimbursement_authority.sql —
  // owner/admin, or a super user (both capabilities already granted). A refund-only
  // or approve-only person deliberately cannot grant, so they can't self-escalate.
  const canGrant = isAdmin(currentUser.role) || (currentUser.canApproveReimbursements && currentUser.canProcessReimbursements);

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Reimbursement authority</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Who can approve or reject a claim, and who can refund it — the two are independent.
        </div>
      </div>

      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "2fr 1fr 1fr",
          padding: "10px 20px",
          fontSize: fontSize.tiny + 0.5,
          fontWeight: fontWeight.bold,
          color: color.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          borderBottom: `1px solid ${color.borderSubtle}`,
        }}
      >
        <div>User</div>
        <div>Approve / Reject</div>
        <div>Refund</div>
      </div>

      {users.map((u) => {
        const admin = isAdmin(u.role);
        return (
          <div
            key={u.id}
            className="grid sm:grid"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr",
              alignItems: "center",
              padding: "12px 20px",
              borderBottom: `1px solid ${color.borderSubtle}`,
              fontSize: fontSize.body,
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={u.name} />
              <div>
                <div style={{ fontWeight: fontWeight.bold }}>{u.name}</div>
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint, textTransform: "capitalize" }}>{u.role}</div>
              </div>
            </div>
            {admin ? (
              <div style={{ fontSize: fontSize.small, color: color.textFaint, gridColumn: "2 / span 2" }}>Full authority (admin)</div>
            ) : (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fontSize.small, color: color.textMuted, cursor: canGrant ? "pointer" : "default" }}>
                  <input
                    type="checkbox"
                    checked={u.canApproveReimbursements}
                    disabled={!canGrant}
                    onChange={(e) => setAuthority.mutate({ userId: u.id, canApprove: e.target.checked, canProcess: u.canProcessReimbursements })}
                  />
                  Approve
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fontSize.small, color: color.textMuted, cursor: canGrant ? "pointer" : "default" }}>
                  <input
                    type="checkbox"
                    checked={u.canProcessReimbursements}
                    disabled={!canGrant}
                    onChange={(e) => setAuthority.mutate({ userId: u.id, canApprove: u.canApproveReimbursements, canProcess: e.target.checked })}
                  />
                  Refund
                </label>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
