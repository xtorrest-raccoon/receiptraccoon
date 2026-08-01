"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canManageReimbursementAuthority, canViewTeamPage, isAdmin } from "@rr/shared";
import { signOut, type CurrentUser } from "@rr/api";
import { color, fontSize, fontWeight, layout, radius } from "@rr/ui-tokens";
import {
  useActiveWorkspaceId,
  useCreateWorkspace,
  useCurrentUser,
  useMyWorkspaces,
  useSetWorkspaceName,
  useSwitchWorkspace,
  useWorkspaceName,
} from "../lib/queries";
import { BillingIcon, DashboardIcon, MileageIcon, ProfileIcon, ReceiptsIcon, SetupIcon, TeamIcon } from "./icons";

interface NavItem {
  href: string;
  label: string;
  Icon: (props: { color: string }) => React.ReactElement;
  /** Omitted means visible to everyone signed in. */
  visible?: (user: CurrentUser) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/receipts", label: "Receipts", Icon: ReceiptsIcon },
  { href: "/mileage", label: "Mileage", Icon: MileageIcon },
  // Deliberately no `visible` gate, unlike Setup below — this is the
  // signed-in user's OWN personal display preferences, not a workspace-wide
  // setting, so every role sees it.
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
  { href: "/team", label: "Team", Icon: TeamIcon, visible: (u) => canViewTeamPage(u.role, u) },
  // Only whoever can grant reimbursement authority in the first place —
  // same audience the Setup page itself gates on.
  { href: "/setup", label: "Setup", Icon: SetupIcon, visible: (u) => canManageReimbursementAuthority(u.role, u) },
  // Stricter than Setup above -- owner/admin only, same gate the Billing
  // page itself enforces (a super user with granted reimbursement
  // authority does NOT get billing access just from that).
  { href: "/billing", label: "Invoice & Payment", Icon: BillingIcon, visible: (u) => isAdmin(u.role) },
];

function visibleItems(currentUser: CurrentUser | undefined) {
  return NAV_ITEMS.filter((item) => !item.visible || (currentUser && item.visible(currentUser)));
}

/**
 * Everyone signed in sees the current workspace's name; only whoever can
 * manage reimbursement authority (same admin/owner-or-super-user audience
 * as the Setup page) gets the dropdown to switch, rename, or add another
 * workspace. Renaming mirrors the original pre-Setup sidebar widget's
 * onBlur-commits pattern; switching just pins a different id (see
 * lib/activeWorkspace.ts) and lets the coarse invalidateAll refetch
 * everything against it.
 */
function WorkspaceSwitcher({ currentUser }: { currentUser: CurrentUser | undefined }) {
  const { data: workspaceName } = useWorkspaceName();
  const { data: workspaces } = useMyWorkspaces();
  const { data: activeId } = useActiveWorkspaceId();
  const setWorkspaceName = useSetWorkspaceName();
  const switchWorkspace = useSwitchWorkspace();
  const createWorkspace = useCreateWorkspace();

  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const canManage = currentUser ? canManageReimbursementAuthority(currentUser.role, currentUser) : false;

  useEffect(() => {
    if (workspaceName !== undefined) setNameDraft(workspaceName);
  }, [workspaceName]);

  if (workspaceName === undefined) return null;

  const commitName = () => {
    setRenaming(false);
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === workspaceName) {
      setNameDraft(workspaceName);
      return;
    }
    setWorkspaceName.mutate(trimmed);
  };

  const commitCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed || createWorkspace.isPending) return;
    createWorkspace.mutate(trimmed, {
      onSuccess: () => {
        setCreating(false);
        setNewName("");
        setOpen(false);
      },
    });
  };

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => canManage && setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: 12,
          borderRadius: radius.lg,
          background: color.surfaceMuted,
          border: "none",
          cursor: canManage ? "pointer" : "default",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: fontSize.tiny + 0.5,
              fontWeight: fontWeight.semibold,
              color: color.textFaint,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Workspace
          </div>
          {canManage && <span style={{ fontSize: fontSize.tiny, color: color.textFaint }}>{open ? "▲" : "▼"}</span>}
        </div>
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            style={{
              width: "100%",
              border: "none",
              background: "none",
              padding: 0,
              marginTop: 4,
              fontSize: fontSize.small + 1,
              fontWeight: fontWeight.bold,
              color: color.textStrong,
            }}
          />
        ) : (
          <div
            style={{
              fontSize: fontSize.small + 1,
              fontWeight: fontWeight.bold,
              color: color.textStrong,
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {workspaceName}
          </div>
        )}
      </button>

      {open && canManage && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius.lg,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 20,
            padding: 6,
          }}
        >
          {(workspaces ?? []).map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => {
                if (ws.id !== activeId) switchWorkspace.mutate(ws.id);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: radius.sm,
                border: "none",
                background: ws.id === activeId ? color.brandTint : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: fontSize.small + 1,
                  fontWeight: ws.id === activeId ? fontWeight.bold : fontWeight.medium,
                  color: color.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ws.name}
              </span>
              {ws.id === activeId && <span style={{ color: color.brand, fontSize: fontSize.small, flexShrink: 0, marginLeft: 6 }}>✓</span>}
            </button>
          ))}

          <div style={{ borderTop: `1px solid ${color.border}`, margin: "4px 0" }} />

          <button
            type="button"
            onClick={() => {
              setRenaming(true);
              setOpen(false);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              borderRadius: radius.sm,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: fontSize.small,
              color: color.textMuted,
              fontWeight: fontWeight.semibold,
            }}
          >
            Rename this workspace
          </button>

          {creating ? (
            <div style={{ padding: "6px 10px" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitCreate();
                  }}
                  placeholder="New workspace name"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: `1px solid ${color.borderStrong}`,
                    borderRadius: radius.sm,
                    padding: "4px 6px",
                    fontSize: fontSize.small,
                  }}
                />
                <button
                  type="button"
                  onClick={commitCreate}
                  disabled={createWorkspace.isPending}
                  style={{
                    border: "none",
                    background: color.brand,
                    color: "#fff",
                    borderRadius: radius.sm,
                    padding: "4px 10px",
                    fontSize: fontSize.small,
                    fontWeight: fontWeight.bold,
                    cursor: "pointer",
                    opacity: createWorkspace.isPending ? 0.6 : 1,
                  }}
                >
                  Add
                </button>
              </div>
              {createWorkspace.isError ? (
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginTop: 4 }}>
                  {createWorkspace.error instanceof Error ? createWorkspace.error.message : "Couldn't create that workspace."}
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: radius.sm,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: fontSize.small,
                color: color.brand,
                fontWeight: fontWeight.bold,
              }}
            >
              + New workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  const items = visibleItems(currentUser);

  return (
    <div
      className="hidden lg:flex"
      style={{
        width: layout.sidebarWidth,
        flexShrink: 0,
        background: color.surface,
        borderRight: `1px solid ${color.border}`,
        flexDirection: "column",
        padding: "12px 14px 20px 14px",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "0 8px 10px 8px" }}>
        <Image src="/logo.png" alt="ReceiptRaccoon" width={140} height={140} />
      </div>

      <WorkspaceSwitcher currentUser={currentUser} />

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
        {items.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: radius.md,
                color: active ? color.textStrong : color.textFaint,
                fontWeight: active ? fontWeight.bold : fontWeight.medium,
                textDecoration: "none",
              }}
            >
              {active ? (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    width: 3,
                    height: 20,
                    borderRadius: 2,
                    background: color.brand,
                    marginLeft: -14,
                  }}
                />
              ) : null}
              <span style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <item.Icon color={active ? color.brand : color.textFaint} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: "14px 12px", borderRadius: radius.lg, background: color.brandTint }}>
          <div style={{ fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: color.brandSoftText, marginBottom: 4 }}>
            Snap a receipt
          </div>
          <div style={{ fontSize: fontSize.small, color: color.textMuted, lineHeight: 1.5 }}>
            Photos taken on the mobile app show up here automatically once parsed.
          </div>
        </div>
        <button
          type="button"
          // No router push here — AppShell's own session subscription
          // redirects to /login once signOut() resolves.
          onClick={() => signOut()}
          style={{
            padding: "8px 0",
            border: "none",
            background: "none",
            color: color.textFaint,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.tiny + 0.5,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function MobileTopBar() {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  const items = visibleItems(currentUser);

  return (
    <div
      className="flex lg:hidden"
      style={{
        alignItems: "center",
        justifyContent: "space-between",
        background: color.surface,
        borderBottom: `1px solid ${color.border}`,
        padding: "10px 16px",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <Image src="/logo.png" alt="ReceiptRaccoon" width={44} height={44} />
      <div style={{ display: "flex", gap: 4 }}>
        {items.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "6px 10px",
                borderRadius: radius.md,
                fontSize: fontSize.small,
                fontWeight: active ? fontWeight.bold : fontWeight.medium,
                color: active ? color.brand : color.textFaint,
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
