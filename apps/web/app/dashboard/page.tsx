"use client";

import { convertDashboardCurrency, convertReceiptCurrency, formatDelta, formatMoney } from "@rr/shared";
import { color, fontSize, fontWeight } from "@rr/ui-tokens";
import { TODAY } from "../../lib/data";
import { useCurrentUser, useDashboard, useFxRate, useFxRatesTo, useMyDisplayPrefs } from "../../lib/queries";
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
  // Own-data personal view -- honors the caller's display currency
  // preference (see apps/web/app/profile/page.tsx) same as MyMileagePanel,
  // independent of whatever the workspace default currency is set to.
  const { data: prefs } = useMyDisplayPrefs();
  const displayCurrency = prefs?.currency ?? dashboard?.currency;
  const { data: fxRate } = useFxRate(dashboard?.currency, displayCurrency);
  const displayDashboard =
    dashboard && displayCurrency && fxRate != null ? convertDashboardCurrency(dashboard, displayCurrency, fxRate) : dashboard;

  // recentReceipts needs its own per-receipt rate, not the single
  // dashboard.currency -> displayCurrency rate above -- see
  // convertDashboardCurrency's own doc comment for why it deliberately
  // leaves these unconverted (a receipt captured before the workspace's
  // currency was last changed carries a different currency of its own).
  // Same fix already applied to the Receipts page's own list.
  const recentFxRates = useFxRatesTo((dashboard?.recentReceipts ?? []).map((r) => r.currency), displayCurrency);
  const recentReceipts = (dashboard?.recentReceipts ?? []).map((r) => {
    if (!displayCurrency || r.currency === displayCurrency) return r;
    const rate = recentFxRates[r.currency];
    return rate != null ? convertReceiptCurrency(r, displayCurrency, rate) : r;
  });

  if (!displayDashboard) return null;
  const { stats, currency } = displayDashboard;

  // null: last month's to-date spend was too small to compare against
  // meaningfully (see MIN_PACE_BASELINE_MINOR in aggregate.ts) — neutral
  // color, no up/down claim.
  const deltaUp = stats.monthDeltaPct !== null && stats.monthDeltaPct > 0;
  const deltaColor = stats.monthDeltaPct === null ? color.textMuted : deltaUp ? color.up : color.down;

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
          subColor={deltaColor}
        />
        <StatCard
          label="Current annual spend to date"
          value={formatMoney(stats.ytdTotalMinor, currency)}
          sub={`Across ${stats.ytdCount} receipts`}
        />
        <StatCard
          label="Owed to you"
          value={formatMoney(stats.reimbursableMinor, currency)}
          sub={`${stats.reimbursablePendingCount} items pending payout`}
        />
        <StatCard label="Receipts this month" value={stats.receiptCount} sub={`${stats.needsReviewCount} need review`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4" style={{ marginBottom: 16 }}>
        <SpendBarChart weeklySpend={displayDashboard.weeklySpend} currency={currency} />
        <SpendPacingCard
          monthToDateMinor={stats.monthTotalMinor}
          prevMonthTotalMinor={displayDashboard.pacing.prevMonthTotalMinor}
          deltaPct={stats.monthDeltaPct}
          elapsedFraction={displayDashboard.pacing.elapsedFraction}
          currency={currency}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4" style={{ marginBottom: 16 }}>
        <CategoryBreakdownCard currency={currency} defaultMonth={CURRENT_MONTH} />
        <TipsCard tips={displayDashboard.tips} />
      </div>

      <RecentReceiptsTable receipts={recentReceipts} />
    </div>
  );
}
