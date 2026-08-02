"use client";

import { useState } from "react";
import type { CurrentUser, WorkspaceUser } from "@rr/api";
import { isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useCreateGroup, useDeleteGroup, useGroups, useRenameGroup, useSetGroupMembers } from "../lib/queries";
import { MultiSelectDropdown, multiSelectControlStyle } from "./MultiSelectDropdown";

/**
 * Purely organizational groupings of people (e.g. "Sales team") -- no
 * authority or reimbursement semantics of their own, unlike the security
 * groups just above (Admin/Finance/Approver/Member). Lives between that
 * table and User currency & mileage on Setup, admin/owner-only to edit —
 * see 0027_groups.sql.
 */
export function GroupsTable({ users, currentUser }: { users: WorkspaceUser[]; currentUser: CurrentUser }) {
  const { data: groups } = useGroups();
  const createGroup = useCreateGroup();
  const renameGroup = useRenameGroup();
  const deleteGroup = useDeleteGroup();
  const setMembers = useSetGroupMembers();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const canManage = isAdmin(currentUser.role);

  const addGroup = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createGroup.mutate(trimmed);
    setNewName("");
  };

  const startEditing = (id: string, name: string) => {
    if (!canManage) return;
    setEditingId(id);
    setEditingName(name);
  };

  const commitRename = () => {
    const trimmed = editingName.trim();
    if (editingId && trimmed) renameGroup.mutate({ groupId: editingId, name: trimmed });
    setEditingId(null);
  };

  if (!groups) return null;

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], marginTop: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Groups</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Organize people into groups (e.g. &ldquo;Sales team&rdquo;) — purely for organization, no approval authority of their own.
        </div>
      </div>

      {canManage ? (
        <div style={{ display: "flex", gap: 8, padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
          <input
            placeholder="New group name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addGroup();
            }}
            style={{
              flex: 1,
              maxWidth: 280,
              padding: "9px 14px",
              borderRadius: radius.md,
              border: `1px solid ${color.borderStrong}`,
              fontSize: fontSize.body,
            }}
          />
          <button
            type="button"
            onClick={addGroup}
            disabled={createGroup.isPending}
            style={{
              padding: "9px 16px",
              borderRadius: radius.md,
              background: color.brand,
              color: color.surface,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              border: "none",
              cursor: "pointer",
              opacity: createGroup.isPending ? 0.6 : 1,
            }}
          >
            Add group
          </button>
        </div>
      ) : null}

      {createGroup.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, padding: "0 20px 12px" }}>
          {createGroup.error instanceof Error ? createGroup.error.message : "Couldn't create that group."}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div style={{ padding: "16px 20px", fontSize: fontSize.small, color: color.textFaint, fontStyle: "italic" }}>No groups yet.</div>
      ) : (
        <>
          <div
            className="hidden sm:grid"
            style={{
              gridTemplateColumns: "1.6fr 2.4fr",
              padding: "10px 20px",
              fontSize: fontSize.tiny + 0.5,
              fontWeight: fontWeight.bold,
              color: color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              borderBottom: `1px solid ${color.borderSubtle}`,
            }}
          >
            <div>Group</div>
            <div>Members</div>
          </div>

          {groups.map((g) => (
            <div
              key={g.id}
              className="grid sm:grid"
              style={{
                gridTemplateColumns: "1.6fr 2.4fr",
                alignItems: "center",
                padding: "12px 20px",
                borderBottom: `1px solid ${color.borderSubtle}`,
                fontSize: fontSize.body,
                gap: 10,
              }}
            >
              <div>
                {editingId === g.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: radius.sm,
                      border: `1px solid ${color.borderStrong}`,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.bold,
                    }}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => startEditing(g.id, g.name)}
                      disabled={!canManage}
                      style={{
                        fontWeight: fontWeight.bold,
                        background: "none",
                        border: "none",
                        padding: 0,
                        textAlign: "left",
                        cursor: canManage ? "pointer" : "default",
                        color: color.text,
                      }}
                    >
                      {g.name}
                    </button>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => deleteGroup.mutate(g.id)}
                        style={{ fontSize: fontSize.tiny + 0.5, color: color.up, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              {canManage ? (
                <MultiSelectDropdown
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  selected={g.memberIds}
                  onChange={(next) => setMembers.mutate({ groupId: g.id, userIds: next })}
                  emptyLabel="No one — not yet assigned"
                  buttonStyle={multiSelectControlStyle}
                />
              ) : g.memberIds.length === 0 ? (
                <span style={{ fontSize: fontSize.small, color: color.textFaint, fontStyle: "italic" }}>No one — not yet assigned</span>
              ) : (
                <span style={{ fontSize: fontSize.small, color: color.textMuted }}>
                  {g.memberIds.map((id) => users.find((u) => u.id === id)?.name ?? "Unknown").join(", ")}
                </span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
