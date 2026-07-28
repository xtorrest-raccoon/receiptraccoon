"use client";

import { useState } from "react";
import { getSession, signInWithPassword, type CurrentUser, type WorkspaceUser } from "@rr/api";
import { canManageReimbursementAuthority, isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { syncSeats } from "../lib/data";
import { useRemoveMember, useSetReimbursementAssignments, useSetReimbursementAuthority } from "../lib/queries";
import { Avatar } from "./Avatar";
import { MultiSelectDropdown, multiSelectControlStyle } from "./MultiSelectDropdown";

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
  const setAuthority = useSetReimbursementAuthority();
  const setAssignments = useSetReimbursementAssignments();
  const removeMember = useRemoveMember();
  const [removing, setRemoving] = useState<WorkspaceUser | null>(null);
  const canGrant = canManageReimbursementAuthority(currentUser.role, currentUser);
  // Stricter than canGrant on purpose — removing someone's access is more
  // severe than granting/revoking a capability, so it stays admin/owner-only
  // even for a super user who can already manage authority.
  const canRemove = isAdmin(currentUser.role);

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
                    onClick={() => setRemoving(u)}
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
