"use client";

import { useState } from "react";
import type { CurrentUser, Group, SecurityGroup, WorkspaceUser } from "@rr/api";
import { canManageReimbursementAuthority, isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { syncSeats } from "../lib/data";
import {
  useDemoteToAdmin,
  useGroups,
  usePromoteToOwner,
  useRemoveMember,
  useSetMemberSecurityGroup,
  useSetReimbursementGroupAssignments,
} from "../lib/queries";
import { Avatar } from "./Avatar";
import { MultiSelectDropdown, multiSelectControlStyle } from "./MultiSelectDropdown";
import { PasswordConfirmModal } from "./PasswordConfirmModal";

function nameOfGroup(groups: Group[], id: string): string {
  return groups.find((g) => g.id === id)?.name ?? "Unknown";
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
  const setAssignments = useSetReimbursementGroupAssignments();
  const removeMember = useRemoveMember();
  const promoteToOwner = usePromoteToOwner();
  const demoteToAdmin = useDemoteToAdmin();
  const { data: groups } = useGroups();
  const [removing, setRemoving] = useState<WorkspaceUser | null>(null);
  const [promoting, setPromoting] = useState<WorkspaceUser | null>(null);
  const [demoting, setDemoting] = useState<WorkspaceUser | null>(null);
  const canGrant = canManageReimbursementAuthority(currentUser.role, currentUser);
  // Stricter than canGrant on purpose — removing someone's access is more
  // severe than granting/revoking a capability, so it stays admin/owner-only
  // even for a super user who can already manage authority.
  const canRemove = isAdmin(currentUser.role);
  // Promoting to Admin writes role, which workspace_members' RLS restricts
  // to an actual admin/owner -- a super user with canGrant but not isAdmin
  // can edit the other three tiers but would just hit an RLS error picking
  // this one, so it's disabled rather than offered and failing.
  const canPromoteToAdmin = isAdmin(currentUser.role);
  // Only an existing System Admin can create another one -- see
  // promote_to_owner() in 0031_second_system_admin.sql. A single System
  // Admin is a single point of failure if that one person loses access, so
  // this nudges toward having a second, and once a workspace has one, that
  // pair is protected in Postgres from ever dropping back to one.
  const currentUserIsOwner = currentUser.role === "owner";
  const ownerCount = users.filter((u) => u.role === "owner").length;
  // Demoting is only ever possible once a workspace has three or more --
  // dropping from exactly two is blocked in Postgres (see
  // enforce_two_system_admins() in 0031_second_system_admin.sql), so the
  // option is hidden rather than offered and guaranteed to fail.
  const canDemoteOwner = currentUserIsOwner && ownerCount > 2;

  return (
    // No overflow: hidden here (unlike other tables in this app) — the
    // Authority on dropdown below is an absolutely-positioned popover that
    // needs to escape this container's bounds, which overflow: hidden would
    // clip instead of just rounding the corners.
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], marginTop: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Profile Definition</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Who can manage platform setup, refund a claim, approve or reject one, and specifically whose claims they cover.
        </div>
      </div>

      {ownerCount < 2 && currentUserIsOwner ? (
        <div style={{ padding: "12px 20px", background: color.brandTint, fontSize: fontSize.small, color: color.text, lineHeight: 1.5 }}>
          This workspace has only one System Admin. If that access is ever lost, nobody else can act as one — promote a
          second person below for redundancy.
        </div>
      ) : null}

      {promoteToOwner.isError ? (
        <div style={{ padding: "10px 20px", fontSize: fontSize.small, color: color.up }}>
          {promoteToOwner.error instanceof Error ? promoteToOwner.error.message : "Couldn't promote that person."}
        </div>
      ) : null}

      {demoteToAdmin.isError ? (
        <div style={{ padding: "10px 20px", fontSize: fontSize.small, color: color.up }}>
          {demoteToAdmin.error instanceof Error ? demoteToAdmin.error.message : "Couldn't demote that person."}
        </div>
      ) : null}

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
        <div>Profile types</div>
        <div>Authority on</div>
      </div>

      {users.map((u) => {
        const owner = u.role === "owner";
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
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint }}>{owner ? "System Admin" : GROUP_STATUS[group]}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                  {canRemove && u.id !== currentUser.id && !owner ? (
                    <button
                      type="button"
                      onClick={() => setRemoving(u)}
                      style={{ fontSize: fontSize.tiny + 0.5, color: color.up, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Remove
                    </button>
                  ) : null}
                  {currentUserIsOwner && !owner ? (
                    <button
                      type="button"
                      onClick={() => setPromoting(u)}
                      style={{ fontSize: fontSize.tiny + 0.5, color: color.brand, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Promote to System Admin
                    </button>
                  ) : null}
                  {canDemoteOwner && owner ? (
                    <button
                      type="button"
                      onClick={() => setDemoting(u)}
                      style={{ fontSize: fontSize.tiny + 0.5, color: color.up, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Demote to Admin
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {owner ? (
              <>
                <span style={{ fontSize: fontSize.small, color: color.textFaint }}>System Admin</span>
                <span style={{ fontSize: fontSize.small, color: color.textFaint }}>Full authority over everyone — cannot be removed</span>
              </>
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
                    options={(groups ?? []).map((g) => ({ value: g.id, label: g.name }))}
                    selected={u.assignedGroupIds}
                    onChange={(next) => setAssignments.mutate({ approverUserId: u.id, groupIds: next })}
                    emptyLabel="No group — not yet assigned"
                  />
                ) : u.assignedGroupIds.length === 0 ? (
                  <span style={{ fontSize: fontSize.small, color: color.textFaint, fontStyle: "italic" }}>No group — not yet assigned</span>
                ) : (
                  <span style={{ fontSize: fontSize.small, color: color.textMuted }}>
                    {u.assignedGroupIds.map((id) => nameOfGroup(groups ?? [], id)).join(", ")}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}

      {removing ? (
        <PasswordConfirmModal
          title={`Remove ${removing.name}?`}
          description="Their receipts and mileage stay on record, but they lose access immediately. Enter your own password to confirm."
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirmed={() => {
            removeMember.mutate(removing.id, { onSuccess: syncSeats });
            setRemoving(null);
          }}
        />
      ) : null}

      {promoting ? (
        <PasswordConfirmModal
          title={`Promote ${promoting.name} to System Admin?`}
          description="They'll have full, unremovable authority over this workspace, same as you. Enter your own password to confirm."
          confirmLabel="Promote"
          onCancel={() => setPromoting(null)}
          onConfirmed={() => {
            promoteToOwner.mutate(promoting.id);
            setPromoting(null);
          }}
        />
      ) : null}

      {demoting ? (
        <PasswordConfirmModal
          title={`Demote ${demoting.name} to Admin?`}
          description="They'll keep full authority over this workspace, but can be removed or further demoted by another System Admin going forward. Enter your own password to confirm."
          confirmLabel="Demote"
          danger
          onCancel={() => setDemoting(null)}
          onConfirmed={() => {
            demoteToAdmin.mutate(demoting.id);
            setDemoting(null);
          }}
        />
      ) : null}
    </div>
  );
}
