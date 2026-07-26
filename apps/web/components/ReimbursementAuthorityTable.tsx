"use client";

import { useState } from "react";
import type { CurrentUser, WorkspaceUser } from "@rr/api";
import { canManageReimbursementAuthority, isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useSetReimbursementAssignments, useSetReimbursementAuthority } from "../lib/queries";
import { Avatar } from "./Avatar";

function nameOf(users: WorkspaceUser[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? "Unknown";
}

const selectStyle = {
  width: "100%",
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.sm,
  padding: "4px 6px",
  fontSize: fontSize.small,
  background: color.surface,
  color: color.text,
};

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
  const setAuthority = useSetReimbursementAuthority();
  const setAssignments = useSetReimbursementAssignments();
  const [editingApproverId, setEditingApproverId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([]);

  const canGrant = canManageReimbursementAuthority(currentUser.role, currentUser);

  const startEditing = (u: WorkspaceUser) => {
    setEditingApproverId(u.id);
    setAssignmentDraft(u.assignedEmployeeIds);
  };

  const saveAssignments = () => {
    if (!editingApproverId) return;
    setAssignments.mutate({ approverUserId: editingApproverId, employeeIds: assignmentDraft });
    setEditingApproverId(null);
  };

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Reimbursement authority</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Who can approve or reject a claim, who can refund it, and specifically whose claims they cover.
        </div>
      </div>

      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1.6fr 1.3fr 2.2fr",
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
        <div>Approval authority</div>
        <div>Authority on</div>
      </div>

      {users.map((u) => {
        const admin = isAdmin(u.role);
        const editing = editingApproverId === u.id;
        const otherUsers = users.filter((other) => other.id !== u.id);

        const selectedAuthority = [
          ...(u.canApproveReimbursements ? ["approve"] : []),
          ...(u.canProcessReimbursements ? ["process"] : []),
        ];

        return (
          <div
            key={u.id}
            className="grid sm:grid"
            style={{
              gridTemplateColumns: "1.6fr 1.3fr 2.2fr",
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
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint, textTransform: "capitalize" }}>{u.role}</div>
              </div>
            </div>

            {admin ? (
              <div style={{ fontSize: fontSize.small, color: color.textFaint, gridColumn: "2 / span 2" }}>
                Full authority over everyone (admin)
              </div>
            ) : (
              <>
                <select
                  multiple
                  value={selectedAuthority}
                  disabled={!canGrant}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setAuthority.mutate({
                      userId: u.id,
                      canApprove: selected.includes("approve"),
                      canProcess: selected.includes("process"),
                    });
                  }}
                  style={{ ...selectStyle, height: 52 }}
                >
                  <option value="approve">Approve / Reject</option>
                  <option value="process">Refund</option>
                </select>

                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <select
                      multiple
                      value={assignmentDraft}
                      onChange={(e) => setAssignmentDraft(Array.from(e.target.selectedOptions).map((o) => o.value))}
                      style={{ ...selectStyle, height: Math.min(140, 30 + otherUsers.length * 22) }}
                    >
                      {otherUsers.map((other) => (
                        <option key={other.id} value={other.id}>
                          {other.name}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={saveAssignments}
                        style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.brand, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingApproverId(null)}
                        style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {u.canApproveReimbursements || u.canProcessReimbursements ? (
                      u.assignedEmployeeIds.length === 0 ? (
                        <span style={{ fontSize: fontSize.small, color: color.textFaint, fontStyle: "italic" }}>
                          No one — not yet assigned
                        </span>
                      ) : (
                        <span style={{ fontSize: fontSize.small, color: color.textMuted }}>
                          {u.assignedEmployeeIds.map((id) => nameOf(users, id)).join(", ")}
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: fontSize.small, color: color.textFaint }}>—</span>
                    )}
                    {canGrant ? (
                      <button
                        type="button"
                        onClick={() => startEditing(u)}
                        style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.brand, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
