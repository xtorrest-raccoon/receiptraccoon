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

  /** Workspace home currency. All reporting aggregates use these fields. */
  currency: string;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number;

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
  /** Frozen at entry, like fxRate. Never recomputed from workspace settings. */
  rateMinor: number;
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
  health: HealthResult;
  tips: BudgetTip[];
  recentReceipts: Receipt[];
}

export interface BudgetTip {
  iconLetter: string;
  tone: "positive" | "warn" | "neutral" | "info";
  text: string;
}

export interface HealthFactor {
  key: "trend" | "backlog" | "concentration" | "hygiene";
  label: string;
  weight: number;
  score: number;
  detail: string;
}

export interface HealthResult {
  score: number;
  label: "On track" | "Needs attention" | "At risk";
  explanation: string;
  factors: HealthFactor[];
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
  mileageRateMinor: number;
  mileageOutstandingMinor: number;
}
