"use client";

import { formatDelta, formatMoney } from "@rr/shared";
import { color, fontSize, fontWeight } from "@rr/ui-tokens";
import { TODAY } from "../../lib/data";
import { useCurrentUser, useDashboard } from "../../lib/queries";
import { StatCard } from "../../components/StatCard";
import { SpendBarChart } from "../../components/SpendBarChart";
import { SpendPacingCard } from "../../components/SpendPacingCard";
import { CategoryBreakdownCard } from "../../components/CategoryBreakdownCard";
import { TipsCard } from "../../components/TipsCard";
import { RecentReceiptsTable } from "../../components/RecentReceiptsTable";

const TODAY_LABEL = new Date(`${TODAY}T00:00:00`).toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const CURRENT_MONTH = TODAY.slice(0, 7);

export default function DashboardPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: dashboard } = useDashboard(CURRENT_MONTH);
  if (!dashboard) return null;
  const { stats, currency } = dashboard;

  const deltaUp = stats.monthDeltaPct > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em" }}>
            {currentUser ? `Welcome back, ${currentUser.name}` : "Dashboard"}
          </div>
          <div style={{ fontSize: fontSize.body, color: color.textMuted, marginTop: 2 }}>{TODAY_LABEL}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ marginBottom: 18 }}>
        <StatCard
          label="Spend this month (incl. tax)"
          value={formatMoney(stats.monthTotalMinor, currency)}
          sub={formatDelta(stats.monthDeltaPct)}
          subColor={deltaUp ? color.up : color.down}
        />
        <StatCard
          label="Current annual spend to date"
          value={formatMoney(stats.ytdTotalMinor, currency)}
          sub={`Across ${stats.ytdCount} receipts`}
        />
        <StatCard
          label="Reimbursable to employee"
          value={formatMoney(stats.reimbursableMinor, currency)}
          sub={`${stats.reimbursablePendingCount} items pending payout`}
        />
        <StatCard label="Receipts this month" value={stats.receiptCount} sub={`${stats.needsReviewCount} need review`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4" style={{ marginBottom: 16 }}>
        <SpendBarChart weeklySpend={dashboard.weeklySpend} currency={currency} />
        <SpendPacingCard
          monthToDateMinor={stats.monthTotalMinor}
          prevMonthTotalMinor={dashboard.pacing.prevMonthTotalMinor}
          deltaPct={stats.monthDeltaPct}
          elapsedFraction={dashboard.pacing.elapsedFraction}
          currency={currency}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4" style={{ marginBottom: 16 }}>
        <CategoryBreakdownCard currency={currency} defaultMonth={CURRENT_MONTH} />
        <TipsCard tips={dashboard.tips} />
      </div>

      <RecentReceiptsTable receipts={dashboard.recentReceipts} />
    </div>
  );
}
