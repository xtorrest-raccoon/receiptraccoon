import { derivedHue } from "./categories.js";
import { daysBetween } from "./format.js";
import { reclaimMinor } from "./money.js";
import type { CategoryBreakdownRow, MileageTrip, Receipt, ReimbursementStatus, Role, TeamMemberSummary } from "./types.js";

/**
 * Pure aggregation math shared between whichever backend supplies the rows
 * (today: @rr/mock-api's in-memory arrays; eventually: real Supabase queries).
 *
 * Deliberately currency-agnostic: every function here assumes the receipts and
 * trips passed in are ALREADY expressed in whatever currency the caller wants
 * displayed. mock-api stores everything in EUR and converts at the read
 * boundary (see its toHome()); a real backend stores amounts already in the
 * workspace's home currency (see packages/db/migrations/0001_init.sql's
 * comment on receipts.currency: "Home-currency amounts. All reporting reads
 * these."). Neither backend's currency model belongs in here — mixing it in
 * would tie this module to one of them.
 */

export const OUTSTANDING_STATUSES: ReimbursementStatus[] = ["pending", "approved"];

export function isOutstanding(status: ReimbursementStatus): boolean {
  return OUTSTANDING_STATUSES.includes(status);
}

export function inMonth(iso: string, yyyyMm: string): boolean {
  return iso.startsWith(yyyyMm);
}

/**
 * "2026-07" -> "2026-06", "2026-01" -> "2025-12". Computed rather than
 * hardcoded so a "vs last month" comparison is correct for whichever month is
 * being viewed, not just the one month any particular seed/test data is dated
 * around.
 */
export function prevMonthOf(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number) as [number, number];
  const d = new Date(year, month - 2, 1); // JS Date months are 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function computeCategoryBreakdown(receipts: Receipt[]): CategoryBreakdownRow[] {
  const total = receipts.reduce((s, r) => s + reclaimMinor(r), 0) || 1;
  const byName = new Map<string, number>();
  for (const r of receipts) {
    const key = r.categoryName ?? "Other";
    byName.set(key, (byName.get(key) ?? 0) + reclaimMinor(r));
  }
  return [...byName.entries()]
    .map(([name, amountMinor]) => ({
      categoryId: `cat_${name.toLowerCase().replace(/\s+/g, "_")}`,
      name,
      hue: derivedHue(name),
      amountMinor,
      pct: (amountMinor / total) * 100,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export interface MonthPacing {
  monthTotalMinor: number;
  monthDeltaPct: number;
  prevMonthTotalMinor: number;
  prevMonthToDateMinor: number;
  elapsedFraction: number;
}

/**
 * Same-day-of-month spend comparison, plus the pacing ring's inputs.
 *
 * Comparing a partial current month against a complete previous one reads as
 * a decrease almost every month until the very last day, so the delta is
 * measured against last month's spend up to the SAME day-of-month instead. A
 * month that has already ended compares in full, since there is no partial
 * period to account for.
 */
export function computeMonthPacing(allReceipts: Receipt[], month: string, today: string): MonthPacing {
  const monthReceipts = allReceipts.filter((r) => inMonth(r.receiptDate ?? "", month));
  const prevReceipts = allReceipts.filter((r) => inMonth(r.receiptDate ?? "", prevMonthOf(month)));

  const monthTotal = monthReceipts.reduce((s, r) => s + reclaimMinor(r), 0);
  const prevTotal = prevReceipts.reduce((s, r) => s + reclaimMinor(r), 0);

  const isCurrentMonth = month === today.slice(0, 7);
  const todayDayOfMonth = Number(today.slice(8, 10));
  const cutoffDay = isCurrentMonth ? todayDayOfMonth : 31;
  const prevToDate = prevReceipts
    .filter((r) => Number((r.receiptDate ?? "").slice(8, 10)) <= cutoffDay)
    .reduce((s, r) => s + reclaimMinor(r), 0);
  const monthDeltaPct = prevToDate ? ((monthTotal - prevToDate) / prevToDate) * 100 : 0;

  // Day 0 of the following month is the last day of this one.
  const [viewYear, viewMonth] = month.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const elapsedFraction = isCurrentMonth ? todayDayOfMonth / daysInMonth : 1;

  return {
    monthTotalMinor: monthTotal,
    monthDeltaPct,
    prevMonthTotalMinor: prevTotal,
    prevMonthToDateMinor: prevToDate,
    elapsedFraction,
  };
}

export function computeWeeklySpend(
  allReceipts: Receipt[],
  today: string,
  weeks = 6,
): { weekStart: string; totalMinor: number }[] {
  const weeklySpend: { weekStart: string; totalMinor: number }[] = [];
  const end = new Date(`${today}T00:00:00`);
  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(end);
    weekEnd.setDate(end.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    const totalMinor = allReceipts
      .filter((r) => {
        const d = new Date(`${r.receiptDate}T00:00:00`);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((s, r) => s + reclaimMinor(r), 0);
    weeklySpend.push({ weekStart: weekStart.toISOString().slice(0, 10), totalMinor });
  }
  return weeklySpend;
}

export interface ReimbursableTotal {
  reimbursableMinor: number;
  reimbursablePendingCount: number;
}

/**
 * What is currently owed across receipts AND mileage, given whichever
 * receipts/trips the caller already scoped (a member's own, or an admin's
 * whole workspace — same shape used for both "Reimbursable to employees" and
 * "Owed to you"). No month restriction: a pending item doesn't stop counting
 * just because the calendar page turned.
 */
export function computeReimbursable(receipts: Receipt[], trips: MileageTrip[]): ReimbursableTotal {
  const outstandingReceipts = receipts.filter((r) => isOutstanding(r.reimbursementStatus));
  const outstandingTrips = trips.filter((t) => isOutstanding(t.reimbursementStatus));
  return {
    reimbursableMinor:
      outstandingReceipts.reduce((s, r) => s + reclaimMinor(r), 0) +
      outstandingTrips.reduce((s, t) => s + t.amountMinor, 0),
    reimbursablePendingCount: outstandingReceipts.length + outstandingTrips.length,
  };
}

/**
 * Per-member rollup for the Team page. `outstandingMinor` here is NOT yet
 * converted to a display currency — sorting on it before conversion is safe
 * (a fixed positive scale factor preserves order), so callers may convert
 * each member's figure afterward without re-sorting.
 */
export function computeTeamMemberSummaries(
  users: { id: string; name: string; jobTitle: string | null; role: Role }[],
  allReceipts: Receipt[],
  today: string,
): TeamMemberSummary[] {
  return users
    .map((u) => {
      const mine = allReceipts.filter((r) => r.createdBy === u.id);
      const outstanding = mine.filter((r) => isOutstanding(r.reimbursementStatus));
      const ages = outstanding.map((r) => daysBetween(r.receiptDate ?? today, today));
      const byCat = new Map<string, number>();
      for (const r of mine) {
        const key = r.categoryName ?? "Other";
        byCat.set(key, (byCat.get(key) ?? 0) + reclaimMinor(r));
      }
      const topCategory = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        userId: u.id,
        name: u.name,
        jobTitle: u.jobTitle,
        role: u.role,
        receiptCount: mine.length,
        outstandingMinor: outstanding.reduce((s, r) => s + reclaimMinor(r), 0),
        oldestPendingDays: ages.length ? Math.max(...ages) : null,
        topCategory,
      };
    })
    .sort((a, b) => b.outstandingMinor - a.outstandingMinor);
}
