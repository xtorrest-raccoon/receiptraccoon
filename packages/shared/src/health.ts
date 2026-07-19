import type { CategoryBreakdownRow, HealthFactor, HealthResult } from "./types.js";

/**
 * Financial health score.
 *
 * This is the COMPOSITE algorithm from the v2 design, which supersedes the formula
 * proposed in BUILD_PLAN.md §2.6. The design's version is better: it drops the
 * "capture consistency" factor, which measured app engagement rather than financial
 * health and was self-serving.
 *
 * The design also ships a Simple/Composite selector. That is a design-review
 * affordance, not a product feature — a user-facing "pick your scoring algorithm"
 * control undermines the number's credibility. Only composite is implemented here.
 * See DESIGN_V2_DELTA.md §6.3.
 *
 * Weights: spend trend 30 · reimbursement backlog 30 · concentration 20 · hygiene 20.
 */

export interface HealthInput {
  /** % change in spend vs previous month. Negative is good. */
  deltaPct: number;
  monthTotalMinor: number;
  reimbursableMinor: number;
  categoryBreakdown: CategoryBreakdownRow[];
  receiptCount: number;
  needsReviewCount: number;
}

/** Below this many receipts the score is not meaningful and we say so. */
const MIN_RECEIPTS_FOR_SCORE = 5;

export function computeHealth(input: HealthInput): HealthResult {
  if (input.receiptCount < MIN_RECEIPTS_FOR_SCORE) {
    return {
      score: 0,
      label: "Needs attention",
      explanation: `Not enough activity yet — log at least ${MIN_RECEIPTS_FOR_SCORE} receipts this month for a meaningful score.`,
      factors: [],
    };
  }

  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  // Spend trend: flat or falling scores full; each 1% of growth costs 2.5 points.
  const trendScore = clamp(100 - Math.max(0, input.deltaPct) * 2.5);

  // Reimbursement backlog: what share of this month's spend is still owed to staff.
  const backlogPct = input.monthTotalMinor
    ? (input.reimbursableMinor / input.monthTotalMinor) * 100
    : 0;
  const backlogScore = clamp(100 - backlogPct);

  // Concentration: penalise only above 30% in a single category.
  const topCat = input.categoryBreakdown[0];
  const topCatPct = topCat ? topCat.pct : 0;
  const concentrationScore = clamp(100 - Math.max(0, topCatPct - 30) * 2);

  // Hygiene: receipts left sitting in needs_review.
  const hygienePct = input.receiptCount
    ? (input.needsReviewCount / input.receiptCount) * 100
    : 0;
  const hygieneScore = clamp(100 - hygienePct * 2);

  const factors: HealthFactor[] = [
    {
      key: "trend",
      label: "Spend trend",
      weight: 30,
      score: trendScore,
      detail:
        input.deltaPct >= 0
          ? `spend up ${input.deltaPct.toFixed(0)}% vs last month`
          : `spend down ${Math.abs(input.deltaPct).toFixed(0)}% vs last month`,
    },
    {
      key: "backlog",
      label: "Reimbursement backlog",
      weight: 30,
      score: backlogScore,
      detail: `${backlogPct.toFixed(0)}% of spend still pending payout`,
    },
    {
      key: "concentration",
      label: "Category concentration",
      weight: 20,
      score: concentrationScore,
      detail: topCat
        ? `${topCatPct.toFixed(0)}% of spend in ${topCat.name}`
        : "spend well spread across categories",
    },
    {
      key: "hygiene",
      label: "Receipt hygiene",
      weight: 20,
      score: hygieneScore,
      detail: `${input.needsReviewCount} of ${input.receiptCount} receipts still need review`,
    },
  ];

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const score = Math.round(
    factors.reduce((s, f) => s + f.score * (f.weight / totalWeight), 0),
  );

  const weakest = factors.reduce((a, b) => (a.score < b.score ? a : b));

  return {
    score,
    label: labelFor(score),
    explanation: `Driven down by ${weakest.label.toLowerCase()} — ${weakest.detail}.`,
    factors,
  };
}

export function labelFor(score: number): HealthResult["label"] {
  if (score >= 80) return "On track";
  if (score >= 60) return "Needs attention";
  return "At risk";
}
