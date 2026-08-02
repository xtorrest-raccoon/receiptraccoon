"use client";

import { useState } from "react";
import { getSession, signInWithPassword, type CurrentUser, type SecurityGroup, type WorkspaceUser } from "@rr/api";
import { canManageReimbursementAuthority, isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { syncSeats } from "../lib/data";
import { useRemoveMember, useSetMemberSecurityGroup, useSetReimbursementAssignments } from "../lib/queries";
import { Avatar } from "./Avatar";
import { MultiSelectDropdown, multiSelectControlStyle } from "./MultiSelectDropdown";

function nameOf(users: WorkspaceUser[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? "Unknown";
}

/**
 * Unifies role and reimbursement authority into one four-tier picker. An
 * existing "both approve and refund" holder (the old combined tier, from
 * before this was Admin/Finance/Approver/Member) has no equivalent option
 * anymore -- shown as Finance until explicitly changed, since refund is the
 * more consequential of the two to silently drop.
 */
function groupOf(u: WorkspaceUser): SecurityGroup {
  if (isAdmin(u.role)) return "admin";
  if (u.canProcessReimbursements) return "finance";
  if (u.canApproveReimbursements) return "approve";
  return "member";
}

const GROUP_OPTIONS: { value: SecurityGroup; label: string }[] = [
  { value: "admin", label: "Admin (privilege to manage platform setup)" },
  { value: "finance", label: "Finance (refund)" },
  { value: "approve", label: "Approver (approve or reject)" },
  { value: "member", label: "Member (no authority)" },
];

/** Short status word for the sub-label under a name — kept distinct from GROUP_OPTIONS' longer dropdown labels. */
const GROUP_STATUS: Record<SecurityGroup, string> = {
  admin: "Admin",
  finance: "Finance",
  approve: "Approver",
  member: "Member",
};

const controlStyle = multiSelectControlStyle;

/**
 * Requires the ACTOR's own password before removing someone — a plain
 * confirm() dialog is too easy to click through for something this
 * destructive. Verifies by attempting signInWithPassword against the
 * actor's own email; Supabase has no separate "check this password"
 * call, but re-authenticating as yourself is harmless and is the standard
 * way to do this client-side.
 */
function RemoveMemberModal({
  targetName,
  onCancel,
  onConfirmed,
}: {
  targetName: string;
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
      style={{ position: "fixed", inset: 0, background: "color-mix(in oklch, black 45%, transparent)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 360, background: color.surface, borderRadius: radius["2xl"], padding: 24 }}
      >
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 6 }}>Remove {targetName}?</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          Their receipts and mileage stay on record, but they lose access immediately. Enter your own password to confirm.
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
          }}
          style={{ width: "100%", border: `1px solid ${error ? color.up : color.borderStrong}`, borderRadius: radius.sm, padding: "9px 12px", fontSize: fontSize.body, marginBottom: 8 }}
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
            style={{ flex: 1, padding: "9px 0", borderRadius: radius.md, border: "none", background: color.up, color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.body, cursor: !password || busy ? "not-allowed" : "pointer", opacity: !password || busy ? 0.6 : 1 }}
          >
            {busy ? "…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Who can approve/reject vs. refund, and specifically whose expenses they're
 * scoped to — separated out from TeamMembersTable (which is spend analytics,
 * a different concern) so this is the one place to manage the whole
 * approval hierarchy. Lives on the Setup page, visible only to whoever
 * canManageReimbursementAuthority — see that page's own gating.
 */
export function ReimbursementAuthorityTable({
  users,
  currentUser,
}: {
  users: WorkspaceUser[];
  currentUser: CurrentUser;
}) {
  const setGroup = useSetMemberSecurityGroup();
  const setAssignments = useSetReimbursementAssignments();
  const removeMember = useRemoveMember();
  const [removing, setRemoving] = useState<WorkspaceUser | null>(null);
  const canGrant = canManageReimbursementAuthority(currentUser.role, currentUser);
  // Stricter than canGrant on purpose — removing someone's access is more
  // severe than granting/revoking a capability, so it stays admin/owner-only
  // even for a super user who can already manage authority.
  const canRemove = isAdmin(currentUser.role);
  // Promoting/demoting Admin writes role, which workspace_members' RLS
  // restricts to an actual admin/owner -- a super user with canGrant but not
  // isAdmin can edit the other three tiers but would just hit an RLS error
  // picking this one, so it's disabled rather than offered and failing.
  const canPromoteToAdmin = isAdmin(currentUser.role);

  return (
    // No overflow: hidden here (unlike other tables in this app) — the
    // Authority on dropdown below is an absolutely-positioned popover that
    // needs to escape this container's bounds, which overflow: hidden would
    // clip instead of just rounding the corners.
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], marginTop: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Security group</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Who can manage platform setup, refund a claim, approve or reject one, and specifically whose claims they cover.
        </div>
      </div>

      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1.6fr 1.5fr 2fr",
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
        <div>Security group</div>
        <div>Authority on</div>
      </div>

      {users.map((u) => {
        const owner = u.role === "owner";
        const otherUsers = users.filter((other) => other.id !== u.id);
        const group = groupOf(u);

        return (
          <div
            key={u.id}
            className="grid sm:grid"
            style={{
              gridTemplateColumns: "1.6fr 1.5fr 2fr",
              alignItems: "start",
              padding: "12px 20px",
              borderBottom: `1px solid ${color.borderSubtle}`,
              fontSize: fontSize.body,
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={u.name} />
              <div>
                <div style={{ fontWeight: fontWeight.bold }}>{u.name}</div>
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint }}>{owner ? "Owner" : GROUP_STATUS[group]}</div>
                {canRemove && u.id !== currentUser.id && u.role !== "owner" ? (
                  <button
                    type="button"
                    onClick={() => setRemoving(u)}
                    style={{ fontSize: fontSize.tiny + 0.5, color: color.up, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {owner ? (
              <div style={{ fontSize: fontSize.small, color: color.textFaint, gridColumn: "2 / span 2" }}>
                Full authority over everyone (owner)
              </div>
            ) : (
              <>
                <select
                  value={group}
                  disabled={!canGrant}
                  onChange={(e) => {
                    const next = e.target.value as SecurityGroup;
                    setGroup.mutate({ userId: u.id, currentRole: u.role, group: next });
                  }}
                  style={controlStyle}
                >
                  {GROUP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} disabled={o.value === "admin" && !canPromoteToAdmin}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {group === "admin" ? (
                  <span style={{ fontSize: fontSize.small, color: color.textFaint }}>Full authority over everyone</span>
                ) : group === "member" ? (
                  <span style={{ fontSize: fontSize.small, color: color.textFaint }}>—</span>
                ) : canGrant ? (
                  <MultiSelectDropdown
                    options={otherUsers.map((other) => ({ value: other.id, label: other.name }))}
                    selected={u.assignedEmployeeIds}
                    onChange={(next) => setAssignments.mutate({ approverUserId: u.id, employeeIds: next })}
                    emptyLabel="No one — not yet assigned"
                  />
                ) : u.assignedEmployeeIds.length === 0 ? (
                  <span style={{ fontSize: fontSize.small, color: color.textFaint, fontStyle: "italic" }}>No one — not yet assigned</span>
                ) : (
                  <span style={{ fontSize: fontSize.small, color: color.textMuted }}>
                    {u.assignedEmployeeIds.map((id) => nameOf(users, id)).join(", ")}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}

      {removing ? (
        <RemoveMemberModal
          targetName={removing.name}
          onCancel={() => setRemoving(null)}
          onConfirmed={() => {
            removeMember.mutate(removing.id, { onSuccess: syncSeats });
            setRemoving(null);
          }}
        />
      ) : null}
    </div>
  );
}
