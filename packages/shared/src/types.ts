export type Role = "owner" | "admin" | "member";

export type ReceiptStatus =
  | "uploading"
  | "processing"
  | "needs_review"
  | "processed"
  | "failed";

export type ReimbursementStatus = "pending" | "approved" | "reimbursed" | "rejected";

export type PaymentType = "credit" | "debit" | "cash" | "other";

export type DistanceUnit = "mi" | "km";

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: Role;
  /** Free-text, display only. Never read by access control — see DESIGN_V2_DELTA.md §9.1. */
  jobTitle: string | null;
  displayName: string;
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  createdAt: string;
}

/** The caller's own pending invite, plus the workspace it's inviting them into — see getMyPendingInvite. */
export interface MyPendingInvite extends WorkspaceInvite {
  workspaceName: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}

export interface Receipt {
  id: string;
  workspaceId: string;
  createdBy: string;
  status: ReceiptStatus;

  imagePath: string | null;
  vendor: string | null;
  receiptDate: string | null; // ISO YYYY-MM-DD

  categoryId: string | null;
  categoryName: string | null;

  /** Workspace home currency. */
  currency: string;
  subtotalMinor: number | null;
  taxMinor: number | null;

  /**
   * What the receipt says was paid. Read-only once extracted — it is a
   * transcription of the document, not a decision.
   */
  totalMinor: number;

  /**
   * What the employee is actually claiming back, which can be less than the total:
   * a shared bill, a meal with a personal portion, a mixed business/personal trip.
   *
   * Null means "the whole total" — use reclaimMinor() rather than reading this
   * directly, so the default is applied in one place.
   *
   * THIS is the figure that feeds spend reporting and reimbursement, not
   * totalMinor. See reclaimMinor() in money.ts.
   */
  reclaimMinor: number | null;

  /** Populated only when the receipt was printed in a different currency. */
  originalCurrency: string | null;
  originalTotalMinor: number | null;
  fxRate: number | null;
  fxRateDate: string | null;

  /** ISO 3166-1 alpha-2, detected from the receipt itself — null if genuinely unclear. */
  country: string | null;

  paymentBrand: string | null;
  paymentLast4: string | null;
  paymentType: PaymentType | null;

  /** Employee-entered. Not extracted — see DESIGN_V2_DELTA.md §5.3. */
  comment: string | null;

  reimbursementStatus: ReimbursementStatus;
  rejectionReason: string | null;

  extractionConfidence: number | null;
  lineItems: LineItem[];
  createdAt: string;
}

export interface MileageTrip {
  id: string;
  workspaceId: string;
  userId: string;
  tripDate: string;
  purpose: string;
  distance: number;
  distanceUnit: DistanceUnit;
  /**
   * Thousandths of a currency unit (€0.675 -> 675), because statutory mileage
   * rates carry three decimals. Frozen at entry, like fxRate — never recomputed
   * from current workspace settings.
   */
  rateMilli: number;
  /** The unit rateMilli is expressed per — see 0014_mileage_rate_unit.sql. Also frozen at entry. */
  rateUnit: DistanceUnit;
  amountMinor: number;
  reimbursementStatus: ReimbursementStatus;
  rejectionReason: string | null;
  /** Populated only when the trip's distance was calculated automatically from these addresses, not typed in manually. */
  startAddress: string | null;
  endAddress: string | null;
}

export interface CategoryBreakdownRow {
  categoryId: string | null;
  name: string;
  hue: number;
  amountMinor: number;
  pct: number;
}

export interface DashboardStats {
  monthTotalMinor: number;
  /**
   * % change against the SAME DAY-OF-MONTH last month, not against last month's
   * full total. A partial month compared to a complete one reads as a decrease
   * almost every month until the last day — see SpendPacing.
   */
  monthDeltaPct: number;
  ytdTotalMinor: number;
  ytdCount: number;
  taxMinor: number;
  reimbursableMinor: number;
  reimbursablePendingCount: number;
  receiptCount: number;
  needsReviewCount: number;
}

export interface DashboardResponse {
  currency: string;
  stats: DashboardStats;
  pacing: SpendPacing;
  weeklySpend: { weekStart: string; totalMinor: number }[];
  categoryBreakdown: CategoryBreakdownRow[];
  tips: BudgetTip[];
  recentReceipts: Receipt[];
}

/**
 * Inputs for the pacing ring: last month's spend is the ring's full circle, and
 * this month's spend so far fills it. A full ring means this month has already
 * matched last month's entire total.
 *
 * Carries only what DashboardStats does not already provide — the month-to-date
 * figure is stats.monthTotalMinor and the comparison percentage is
 * stats.monthDeltaPct, so neither is duplicated here.
 */
export interface SpendPacing {
  /** Last month's FULL total — the ring's 100% mark. */
  prevMonthTotalMinor: number;
  /**
   * Last month's spend up to the same day-of-month. This is the baseline
   * stats.monthDeltaPct is measured against, and the only honest like-for-like
   * comparison mid-month.
   */
  prevMonthToDateMinor: number;
  /**
   * 0-1 through the current month, where the ring's pace marker sits. A fill
   * further round than this marker means spending is running ahead of last
   * month. 1 for a month already complete.
   */
  elapsedFraction: number;
}

export interface BudgetTip {
  iconLetter: string;
  tone: "positive" | "warn" | "neutral" | "info";
  text: string;
}

export interface TeamMemberSummary {
  userId: string;
  name: string;
  jobTitle: string | null;
  role: Role;
  receiptCount: number;
  outstandingMinor: number;
  oldestPendingDays: number | null;
  topCategory: string | null;
}

/**
 * "Owed to you" — outstanding receipts and mileage, still pending or approved.
 * Reimbursed and rejected are both excluded: reimbursed because it has been
 * paid, rejected because it is not awaiting anything.
 *
 * Scope follows the same role rule as everywhere else in this app: a member
 * sees their own claims, an owner/admin sees the whole workspace. For an
 * admin that is the same population as the Team page's outstandingRefundMinor
 * — they are the one clearing the backlog, so "owed to you" means what the
 * business owes, not just their own personal handful of receipts.
 *
 * amountMinor and receiptCount are returned together, from one filtered set,
 * specifically so a screen showing both can never have them describe two subtly
 * different populations of receipts.
 */
export interface OwedToUserSummary {
  /** Receipts (reclaim amount) plus mileage trips, both still outstanding. */
  amountMinor: number;
  /** Receipts only — mileage trips are not "receipts". */
  receiptCount: number;
}

export interface TeamResponse {
  currency: string;
  outstandingRefundMinor: number;
  outstandingRefundCount: number;
  agedOver30Minor: number;
  agedOver30Count: number;
  teamTotalMinor: number;
  /** This month's mileage trips, at each trip's own frozen rate — see MileageTrip.rateMilli. */
  teamMileageTotalMinor: number;
  userCount: number;
  /** Receipts and mileage trips still awaiting a reimbursement decision (reimbursementStatus === "pending"), this month. */
  needsReviewCount: number;
  topSpenderName: string | null;
  members: TeamMemberSummary[];
  mileage: MileageTrip[];
  /** Thousandths of a currency unit. See MileageTrip.rateMilli. */
  mileageRateMilli: number;
  mileageOutstandingMinor: number;
}
