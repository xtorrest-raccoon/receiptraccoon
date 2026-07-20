"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  canViewTeamPage,
  formatMoney,
  currencySymbol,
  rateToDecimalString,
  type ReimbursementStatus,
} from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { getCurrentUser, getTeam, listMileage, listUsers } from "../../lib/data";
import { useDataStore } from "../../lib/store";
import { StatCard } from "../../components/StatCard";
import { TeamMembersTable } from "../../components/TeamMembersTable";
import { MileageTable } from "../../components/MileageTable";

/** Translucent red-on-dark panel, mixed from the `up` (bad-trend) token — there
 * is no dedicated "alert on dark" entry in @rr/ui-tokens. */
const AGED_ALERT_BG = `color-mix(in oklch, ${color.up} 28%, transparent)`;

export default function TeamPage() {
  const currentUser = getCurrentUser();
  const allowed = canViewTeamPage(currentUser.role);

  // Hooks run unconditionally — canViewTeamPage(role) never changes mid-mount
  // (there's no in-app role switcher), but keeping hook order fixed regardless
  // of the auth branch is the safe pattern.
  const { version } = useDataStore();
  const team = useMemo(() => (allowed ? getTeam() : null), [version, allowed]);
  const [mileageUserFilter, setMileageUserFilter] = useState("All");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ReimbursementStatus>>({});
  const users = listUsers();

  const mileage = useMemo(() => (allowed ? listMileage(mileageUserFilter) : []), [mileageUserFilter, version, allowed]);

  const mileageOutstandingMinor = useMemo(() => {
    return mileage
      .filter((t) => {
        const s = statusOverrides[t.id] ?? t.reimbursementStatus;
        return s === "pending" || s === "approved";
      })
      .reduce((sum, t) => sum + t.amountMinor, 0);
  }, [mileage, statusOverrides]);

  if (!allowed || !team) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, marginBottom: 8 }}>403 — Not authorized</div>
        <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          The Team page is only visible to workspace owners and admins. Signed in as {currentUser.name} ({currentUser.role}).
        </div>
        <Link href="/dashboard" style={{ color: color.brand, fontWeight: fontWeight.bold, fontSize: fontSize.body }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Team spend</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        Expense situation across everyone on the account this month.
      </div>

      <div
        className="flex-col sm:flex-row"
        style={{
          background: color.inkPanel,
          borderRadius: radius["2xl"],
          padding: "20px 24px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: fontSize.small, color: color.inkPanelText, fontWeight: fontWeight.semibold }}>
            Outstanding refund — all pending &amp; approved receipts, any month
          </div>
          <div style={{ fontSize: fontSize.stat, fontWeight: fontWeight.heavy, color: color.surface, marginTop: 8 }}>
            {formatMoney(team.outstandingRefundMinor, team.currency)}
          </div>
          <div style={{ fontSize: fontSize.small, color: color.inkPanelText, marginTop: 4 }}>
            Across {team.outstandingRefundCount} receipts
          </div>
        </div>
        {team.agedOver30Count > 0 ? (
          <div style={{ background: AGED_ALERT_BG, borderRadius: radius.lg, padding: "14px 18px" }}>
            <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.up }}>Over 30 days old</div>
            <div style={{ fontSize: fontSize.h2 - 1, fontWeight: fontWeight.heavy, color: color.surface, marginTop: 4 }}>
              {formatMoney(team.agedOver30Minor, team.currency)}
            </div>
            <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginTop: 2 }}>{team.agedOver30Count} receipts need attention</div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ marginBottom: 18 }}>
        <StatCard label="Team spend this month" value={formatMoney(team.teamTotalMinor, team.currency)} valueSize={fontSize.stat - 2} />
        <StatCard label="Active users" value={team.userCount} valueSize={fontSize.stat - 2} />
        <StatCard label="Needs review" value={team.needsReviewCount} valueSize={fontSize.stat - 2} />
        <StatCard label="Highest spender" value={team.topSpenderName ?? "—"} valueSize={fontSize.h3} />
      </div>

      <TeamMembersTable members={team.members} currency={team.currency} />

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden", marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${color.borderSubtle}`,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Mileage reimbursements</div>
            <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
              {/* Rates carry three decimals; formatMoney would round 0.675 to 0.68. */}
              Logged from the mobile app · rate {currencySymbol(team.currency)}
              {rateToDecimalString(team.mileageRateMilli)}/mi
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <select
              value={mileageUserFilter}
              onChange={(e) => setMileageUserFilter(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: radius.sm + 1,
                border: `1px solid ${color.borderStrong}`,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                background: color.surface,
                color: color.text,
              }}
            >
              <option value="All">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy }}>{formatMoney(mileageOutstandingMinor, team.currency)}</div>
          </div>
        </div>

        <MileageTable
          trips={mileage}
          currency={team.currency}
          statusOverrides={statusOverrides}
          onStatusChange={(id, status) => setStatusOverrides((prev) => ({ ...prev, [id]: status }))}
        />
      </div>
    </div>
  );
}
