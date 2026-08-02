"use client";

import { useState } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import type { PlatformWorkspaceMember } from "@rr/api";
import { useIsPlatformAdmin, usePlatformListWorkspaceMembers, usePlatformPromoteToOwner } from "../../lib/queries";
import { PasswordConfirmModal } from "../../components/PasswordConfirmModal";

/**
 * Recovery tool for when every System Admin on a workspace is unreachable
 * -- see 0032_platform_support.sql. Deliberately not linked from Sidebar;
 * reachable only by a platform admin who already knows this URL. Every
 * promotion made here is permanently logged server-side regardless of
 * whether anyone ever looks at this page again.
 */
export default function PlatformAdminPage() {
  const { data: isPlatformAdmin, isLoading } = useIsPlatformAdmin();
  const [workspaceId, setWorkspaceId] = useState("");
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<PlatformWorkspaceMember | null>(null);
  const listMembers = usePlatformListWorkspaceMembers();
  const promoteToOwner = usePlatformPromoteToOwner();

  const load = () => {
    const trimmed = workspaceId.trim();
    if (!trimmed) return;
    listMembers.mutate(trimmed, { onSuccess: () => setLoadedWorkspaceId(trimmed) });
  };

  if (isLoading) return null;

  if (!isPlatformAdmin) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, marginBottom: 8 }}>404</div>
        <div style={{ fontSize: fontSize.body, color: color.textMuted }}>Nothing here.</div>
      </div>
    );
  }

  const members = listMembers.data ?? [];

  return (
    <div style={{ maxWidth: 640, margin: "40px auto" }}>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, marginBottom: 4 }}>Workspace recovery</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
        Promotes an existing member of a workspace to System Admin, for when every current one is unreachable. Every
        use is permanently logged. Only promote someone whose identity you've verified out-of-band.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          placeholder="Workspace ID"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
          style={{ flex: 1, padding: "9px 14px", borderRadius: radius.md, border: `1px solid ${color.borderStrong}`, fontSize: fontSize.body }}
        />
        <button
          type="button"
          onClick={load}
          disabled={listMembers.isPending}
          style={{
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            border: "none",
            cursor: "pointer",
            opacity: listMembers.isPending ? 0.6 : 1,
          }}
        >
          {listMembers.isPending ? "…" : "Load members"}
        </button>
      </div>

      {listMembers.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginBottom: 16 }}>
          {listMembers.error instanceof Error ? listMembers.error.message : "Couldn't load that workspace."}
        </div>
      ) : null}

      {promoteToOwner.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginBottom: 16 }}>
          {promoteToOwner.error instanceof Error ? promoteToOwner.error.message : "Couldn't promote that person."}
        </div>
      ) : null}

      {promoteToOwner.isSuccess ? (
        <div style={{ fontSize: fontSize.small, color: color.brand, marginBottom: 16 }}>Promoted — logged, and the workspace was notified by email.</div>
      ) : null}

      {loadedWorkspaceId && members.length > 0 ? (
        <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"] }}>
          {members.map((m) => (
            <div
              key={m.userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: `1px solid ${color.borderSubtle}`,
                fontSize: fontSize.body,
              }}
            >
              <div>
                <div style={{ fontWeight: fontWeight.bold }}>{m.name}</div>
                <div style={{ fontSize: fontSize.small, color: color.textMuted }}>
                  {m.email} · <span style={{ textTransform: "capitalize" }}>{m.role}</span>
                </div>
              </div>
              {m.role === "owner" ? (
                <span style={{ fontSize: fontSize.small, color: color.textFaint }}>Already System Admin</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPromoting(m)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: radius.md,
                    background: "transparent",
                    color: color.brand,
                    fontWeight: fontWeight.bold,
                    fontSize: fontSize.small,
                    border: `1px solid ${color.borderStrong}`,
                    cursor: "pointer",
                  }}
                >
                  Promote to System Admin
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {promoting ? (
        <PasswordConfirmModal
          title={`Promote ${promoting.name} to System Admin?`}
          description="This bypasses normal authorization -- only do this for a verified recovery request. Every workspace member will be emailed. Enter your own password to confirm."
          confirmLabel="Promote"
          danger
          onCancel={() => setPromoting(null)}
          onConfirmed={() => {
            if (loadedWorkspaceId) promoteToOwner.mutate({ workspaceId: loadedWorkspaceId, targetUserId: promoting.userId });
            setPromoting(null);
          }}
        />
      ) : null}
    </div>
  );
}
