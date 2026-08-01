"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canManageReimbursementAuthority, canViewTeamPage } from "@rr/shared";
import { signOut, type CurrentUser } from "@rr/api";
import { color, fontSize, fontWeight, layout, radius } from "@rr/ui-tokens";
import { useCurrentUser, useWorkspaceName } from "../lib/queries";
import { DashboardIcon, MileageIcon, ReceiptsIcon, SetupIcon, TeamIcon } from "./icons";

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
  { href: "/team", label: "Team", Icon: TeamIcon, visible: (u) => canViewTeamPage(u.role, u) },
  // Only whoever can grant reimbursement authority in the first place —
  // same audience the Setup page itself gates on.
  { href: "/setup", label: "Setup", Icon: SetupIcon, visible: (u) => canManageReimbursementAuthority(u.role, u) },
];

function visibleItems(currentUser: CurrentUser | undefined) {
  return NAV_ITEMS.filter((item) => !item.visible || (currentUser && item.visible(currentUser)));
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  const { data: workspaceName } = useWorkspaceName();
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

      {/* Read-only -- renaming the workspace lives on the admin-only Setup
          page now, but everyone signed in still sees which workspace they're
          in, same as before Setup existed. */}
      {workspaceName ? (
        <div
          style={{
            textAlign: "center",
            fontSize: fontSize.small,
            fontWeight: fontWeight.bold,
            color: color.textStrong,
            padding: "0 8px 12px 8px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {workspaceName}
        </div>
      ) : null}

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
