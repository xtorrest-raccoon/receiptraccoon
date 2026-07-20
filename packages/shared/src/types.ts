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
  amountMinor: number;
  reimbursementStatus: ReimbursementStatus;
  rejectionReason: string | null;
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
  weeklySpend: { weekStart: string; totalMinor: number }[];
  categoryBreakdown: CategoryBreakdownRow[];
  processing: ReceiptProcessing;
  tips: BudgetTip[];
  recentReceipts: Receipt[];
}

export interface BudgetTip {
  iconLetter: string;
  tone: "positive" | "warn" | "neutral" | "info";
  text: string;
}

/** One reimbursement-status slice of a ReceiptProcessing breakdown. */
export interface ProcessingSegment {
  status: ReimbursementStatus;
  amountMinor: number;
  /** 0-100, this segment's share of totalMinor. */
  pct: number;
}

/**
 * What proportion of claimed spend sits in each stage of the reimbursement
 * pipeline, over a trailing window. Replaces the earlier financial-health score —
 * see processing.ts for why. Segments with a zero amount are omitted, and sum to
 * 100% of totalMinor (up to rounding) across whatever segments remain.
 */
export interface ReceiptProcessing {
  windowDays: number;
  totalMinor: number;
  receiptCount: number;
  segments: ProcessingSegment[];
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
 * Personal outstanding balance for the signed-in user — receipts and mileage they
 * submitted that are still pending or approved. Reimbursed and rejected are both
 * excluded: reimbursed because it has been paid, rejected because it is not
 * awaiting anything.
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
  userCount: number;
  needsReviewCount: number;
  topSpenderName: string | null;
  members: TeamMemberSummary[];
  mileage: MileageTrip[];
  /** Thousandths of a currency unit. See MileageTrip.rateMilli. */
  mileageRateMilli: number;
  mileageOutstandingMinor: number;
}
