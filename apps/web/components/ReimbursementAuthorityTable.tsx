"use client";

import { useState } from "react";
import type { CurrentUser, WorkspaceUser } from "@rr/api";
import { canManageReimbursementAuthority, isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useRemoveMember, useSetReimbursementAssignments, useSetReimbursementAuthority } from "../lib/queries";
import { Avatar } from "./Avatar";

function nameOf(users: WorkspaceUser[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? "Unknown";
}

type AuthorityLevel = "none" | "approve" | "process" | "both";

function levelOf(u: WorkspaceUser): AuthorityLevel {
  if (u.canApproveReimbursements && u.canProcessReimbursements) return "both";
  if (u.canApproveReimbursements) return "approve";
  if (u.canProcessReimbursements) return "process";
  return "none";
}

const AUTHORITY_OPTIONS: { value: AuthorityLevel; label: string }[] = [
  { value: "none", label: "No authority" },
  { value: "approve", label: "Approve / Reject" },
  { value: "process", label: "Refund" },
  { value: "both", label: "Approve, Reject & Refund" },
];

/** Short status word for the sub-label under a name — kept distinct from AUTHORITY_OPTIONS' longer dropdown labels. */
const LEVEL_STATUS: Record<AuthorityLevel, string | null> = {
  none: null,
  approve: "Approver",
  process: "Refunder",
  both: "Super user",
};

const controlStyle = {
  width: "100%",
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.sm,
  padding: "6px 8px",
  fontSize: fontSize.small,
  background: color.surface,
  color: color.text,
  cursor: "pointer",
};

/**
 * Closed by default, opens a checkbox list — same shape as a native
 * <select multiple> but readable at a glance and doesn't need Ctrl/Cmd-click
 * to pick more than one. Commits each toggle immediately, so there's no
 * separate Save step, matching how a plain dropdown feels.
 */
function MultiSelectDropdown({
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = selected.length === 0 ? emptyLabel : options.filter((o) => selected.includes(o.value)).map((o) => o.label).join(", ");

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...controlStyle, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
        <span style={{ color: color.textFaint, flexShrink: 0 }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 10,
            minWidth: 200,
            maxHeight: 220,
            overflowY: "auto",
            background: color.surface,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: radius.sm,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 6,
          }}
        >
          {options.length === 0 ? (
            <div style={{ fontSize: fontSize.small, color: color.textFaint, padding: "6px 8px" }}>No other members yet.</div>
          ) : (
            options.map((o) => (
              <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: fontSize.small, color: color.text, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
                />
                {o.label}
              </label>
            ))
          )}
          <div style={{ borderTop: `1px solid ${color.borderSubtle}`, marginTop: 4, paddingTop: 4, textAlign: "right" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.brand, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
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
  const setAuthority = useSetReimbursementAuthority();
  const setAssignments = useSetReimbursementAssignments();
  const removeMember = useRemoveMember();
  const canGrant = canManageReimbursementAuthority(currentUser.role, currentUser);
  // Stricter than canGrant on purpose — removing someone's access is more
  // severe than granting/revoking a capability, so it stays admin/owner-only
  // even for a super user who can already manage authority.
  const canRemove = isAdmin(currentUser.role);

  const remove = (u: WorkspaceUser) => {
    if (!window.confirm(`Remove ${u.name} from this workspace? Their receipts and mileage stay on record, but they lose access immediately.`)) {
      return;
    }
    removeMember.mutate(u.id);
  };

  return (
    // No overflow: hidden here (unlike other tables in this app) — the
    // Authority on dropdown below is an absolutely-positioned popover that
    // needs to escape this container's bounds, which overflow: hidden would
    // clip instead of just rounding the corners.
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], marginTop: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Reimbursement authority</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Who can approve or reject a claim, who can refund it, and specifically whose claims they cover.
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
        <div>Approval authority</div>
        <div>Authority on</div>
      </div>

      {users.map((u) => {
        const admin = isAdmin(u.role);
        const otherUsers = users.filter((other) => other.id !== u.id);
        const level = levelOf(u);

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
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint }}>
                  <span style={{ textTransform: "capitalize" }}>{u.role}</span>
                  {!admin && LEVEL_STATUS[level] ? ` · ${LEVEL_STATUS[level]}` : ""}
                </div>
                {canRemove && u.id !== currentUser.id && u.role !== "owner" ? (
                  <button
                    type="button"
                    onClick={() => remove(u)}
                    style={{ fontSize: fontSize.tiny + 0.5, color: color.up, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {admin ? (
              <div style={{ fontSize: fontSize.small, color: color.textFaint, gridColumn: "2 / span 2" }}>
                Full authority over everyone (admin)
              </div>
            ) : (
              <>
                <select
                  value={level}
                  disabled={!canGrant}
                  onChange={(e) => {
                    const next = e.target.value as AuthorityLevel;
                    setAuthority.mutate({
                      userId: u.id,
                      canApprove: next === "approve" || next === "both",
                      canProcess: next === "process" || next === "both",
                    });
                  }}
                  style={controlStyle}
                >
                  {AUTHORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {level === "none" ? (
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
    </div>
  );
}
