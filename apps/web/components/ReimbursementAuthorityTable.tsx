"use client";

import { useEffect, useState } from "react";
import type { CurrentUser, WorkspaceUser } from "@rr/api";
import { isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useSetReimbursementAssignments, useSetReimbursementAuthority, useSetWorkspaceName, useWorkspaceName } from "../lib/queries";
import { Avatar } from "./Avatar";

function nameOf(users: WorkspaceUser[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? "Unknown";
}

/**
 * Who can approve/reject vs. refund, and specifically whose expenses they're
 * scoped to — separated out from TeamMembersTable (which is spend analytics,
 * a different concern) so this is the one place an admin manages the whole
 * approval hierarchy. Also hosts the workspace name field, moved here from
 * the sidebar as the other piece of "how this workspace is set up."
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
  const { data: workspaceName } = useWorkspaceName();
  const setWorkspaceName = useSetWorkspaceName();
  const [nameDraft, setNameDraft] = useState("");
  const [editingApproverId, setEditingApproverId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([]);

  useEffect(() => {
    if (workspaceName !== undefined) setNameDraft(workspaceName);
  }, [workspaceName]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === workspaceName) {
      setNameDraft(workspaceName ?? "");
      return;
    }
    setWorkspaceName.mutate(trimmed);
  };

  // Mirrors can_grant_reimbursement_authority() in 0007_reimbursement_authority.sql —
  // owner/admin, or a super user (both capabilities already granted). A refund-only
  // or approve-only person deliberately cannot grant, so they can't self-escalate.
  const canGrant = isAdmin(currentUser.role) || (currentUser.canApproveReimbursements && currentUser.canProcessReimbursements);

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
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2, marginBottom: 14 }}>
          Who can approve or reject a claim, who can refund it, and specifically whose claims they cover.
        </div>

        <div style={{ maxWidth: 280 }}>
          <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
            Workspace name
          </div>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
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
          />
        </div>
      </div>

      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1.6fr 1fr 1fr 2fr",
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
        <div>Authority on</div>
      </div>

      {users.map((u) => {
        const admin = isAdmin(u.role);
        const editing = editingApproverId === u.id;
        const otherUsers = users.filter((other) => other.id !== u.id);
        return (
          <div key={u.id} style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
            <div
              className="grid sm:grid"
              style={{
                gridTemplateColumns: "1.6fr 1fr 1fr 2fr",
                alignItems: "center",
                padding: "12px 20px",
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
                <div style={{ fontSize: fontSize.small, color: color.textFaint, gridColumn: "2 / span 3" }}>
                  Full authority over everyone (admin)
                </div>
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

                  {editing ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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

            {editing ? (
              <div style={{ padding: "0 20px 14px 20px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                {otherUsers.length === 0 ? (
                  <span style={{ fontSize: fontSize.small, color: color.textFaint }}>No other members yet.</span>
                ) : (
                  otherUsers.map((other) => (
                    <label key={other.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fontSize.small, color: color.textMuted, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={assignmentDraft.includes(other.id)}
                        onChange={(e) =>
                          setAssignmentDraft((prev) =>
                            e.target.checked ? [...prev, other.id] : prev.filter((id) => id !== other.id),
                          )
                        }
                      />
                      {other.name}
                    </label>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
