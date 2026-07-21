"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canViewTeamPage } from "@rr/shared";
import { signOut } from "@rr/api";
import { color, fontSize, fontWeight, layout, radius } from "@rr/ui-tokens";
import { CURRENCIES } from "../lib/data";
import { useCurrentUser, useHomeCurrency, useSetHomeCurrency } from "../lib/queries";
import { DashboardIcon, LogoMark, ReceiptsIcon, TeamIcon } from "./icons";

interface NavItem {
  href: string;
  label: string;
  Icon: (props: { color: string }) => React.ReactElement;
  requiresAdmin: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon, requiresAdmin: false },
  { href: "/receipts", label: "Receipts", Icon: ReceiptsIcon, requiresAdmin: false },
  { href: "/team", label: "Team", Icon: TeamIcon, requiresAdmin: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  const { data: homeCurrency } = useHomeCurrency();
  const setHomeCurrency = useSetHomeCurrency();
  const role = currentUser?.role;
  const items = NAV_ITEMS.filter((item) => !item.requiresAdmin || (role && canViewTeamPage(role)));

  return (
    <div
      className="hidden lg:flex"
      style={{
        width: layout.sidebarWidth,
        flexShrink: 0,
        background: color.surface,
        borderRight: `1px solid ${color.border}`,
        flexDirection: "column",
        padding: "20px 14px",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 22px 8px" }}>
        <LogoMark faceColor={color.textStrong} noseColor={color.brand} />
        <div style={{ fontWeight: fontWeight.heavy, fontSize: fontSize.base + 2, letterSpacing: "-0.01em" }}>
          ReceiptRaccoon
        </div>
      </div>

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
        <div style={{ padding: 12, borderRadius: radius.lg, background: color.surfaceMuted }}>
          <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
            Home currency
          </div>
          <select
            value={homeCurrency ?? "EUR"}
            onChange={(e) => setHomeCurrency.mutate(e.target.value)}
            style={{
              width: "100%",
              border: `1px solid ${color.borderStrong}`,
              borderRadius: radius.sm,
              padding: "6px 8px",
              fontSize: fontSize.small + 0.5,
              fontWeight: fontWeight.semibold,
              background: color.surface,
              color: color.text,
            }}
          >
            {CURRENCIES.map((cur) => (
              <option key={cur} value={cur}>
                {cur}
              </option>
            ))}
          </select>
          <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>
            Foreign receipts are auto-converted at scan time using the latest rate.
          </div>
        </div>
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
  const role = currentUser?.role;
  const items = NAV_ITEMS.filter((item) => !item.requiresAdmin || (role && canViewTeamPage(role)));

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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LogoMark faceColor={color.textStrong} noseColor={color.brand} size={28} />
        <div style={{ fontWeight: fontWeight.heavy, fontSize: fontSize.base }}>ReceiptRaccoon</div>
      </div>
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
