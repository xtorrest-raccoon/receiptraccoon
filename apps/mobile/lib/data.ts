/**
 * The single seam between the app and `@rr/mock-api`.
 *
 * Per PHASE1.md: "Wrap every call in a thin per-app data module ... so swapping to
 * the real API later touches one file, not every screen." No screen or component
 * may `import ... from "@rr/mock-api"` directly — everything goes through here.
 *
 * Two things in this file are NOT simple passthroughs, and both exist because the
 * real backend isn't provisioned yet (see PHASE1.md, "Supabase is not provisioned
 * yet"):
 *
 * 1. `patchReceiptLocal` / `getReceiptMerged` — the mock API has no endpoint to
 *    persist a comment or a corrected total (the real one will be `PATCH
 *    /receipts/:id` per schemas.ts's `PatchReceiptBody`). Edits are kept in an
 *    in-memory overlay for the session so the Confirm/Receipt-detail screens feel
 *    real, without inventing a fake persistence layer inside packages/.
 * 2. `simulateExtraction` — there is no OCR endpoint yet either (see
 *    OCR_PLAN.md / schemas.ts's `ReceiptExtractionLoose`). This stands in for it
 *    with a realistic delay and returns a blank, user-fillable draft rather than
 *    fabricating a fake vendor/total, which would be misleading in a receipts app.
 */

import {
  getDashboard as mockGetDashboard,
  listReceipts as mockListReceipts,
  getReceipt as mockGetReceipt,
  listMileage as mockListMileage,
  addMileageTrip as mockAddMileageTrip,
  listCategories as mockListCategories,
  HOME_CURRENCY as MOCK_HOME_CURRENCY,
  TODAY as MOCK_TODAY,
  CURRENT_USER,
} from "@rr/mock-api";
import {
  formatMonthLabel,
  type DashboardResponse,
  type Receipt,
  type MileageTrip,
  type DistanceUnit,
} from "@rr/shared";

export const HOME_CURRENCY = MOCK_HOME_CURRENCY;
/** Anchor "today" to the mock data's own reference date, not the device clock — the
 * seed receipts and trips are dated relative to it. */
export const TODAY = MOCK_TODAY;
export const CURRENT_MONTH = TODAY.slice(0, 7);

export function getCurrentUser() {
  return CURRENT_USER;
}

export function getDashboard(month?: string): DashboardResponse {
  return mockGetDashboard(month);
}

export function listReceipts(opts: { month?: string; categoryName?: string; q?: string } = {}): Receipt[] {
  return mockListReceipts(opts).map(mergeReceiptEdits);
}

export function getReceipt(id: string): Receipt | undefined {
  const r = mockGetReceipt(id);
  return r ? mergeReceiptEdits(r) : undefined;
}

export function listMileage(): MileageTrip[] {
  return mockListMileage();
}

export function addMileageTrip(input: {
  tripDate: string;
  purpose: string;
  distance: number;
  distanceUnit: DistanceUnit;
}): MileageTrip {
  return mockAddMileageTrip(input);
}

export function listCategories(): string[] {
  return mockListCategories();
}

/** Months that have at least one receipt, oldest first — powers the month picker. */
export function getAvailableMonths(): { value: string; label: string }[] {
  const all = mockListReceipts({});
  const months = Array.from(
    new Set(all.map((r) => (r.receiptDate ?? "").slice(0, 7)).filter(Boolean)),
  ).sort();
  return months.map((m) => ({ value: m, label: formatMonthLabel(m) }));
}

/** Reimbursement statuses that still owe the employee money. Mirrors mock-api's
 * internal (unexported) OUTSTANDING list — a plain filter over the public
 * ReimbursementStatus enum, not a re-derivation of business logic. */
const OUTSTANDING_STATUSES: ReadonlySet<string> = new Set(["pending", "approved"]);

/**
 * `getDashboard().stats.reimbursableMinor` only totals outstanding receipts —
 * the design's home-screen caption says "Incl. mileage", so this adds
 * outstanding mileage trips for the same month on top, the same way the design
 * intends the number to read.
 */
export function getReimbursableInclMileageMinor(month: string): number {
  const dashboard = mockGetDashboard(month);
  const mileageOutstanding = mockListMileage()
    .filter((t) => t.tripDate.startsWith(month) && OUTSTANDING_STATUSES.has(t.reimbursementStatus))
    .reduce((sum, t) => sum + t.amountMinor, 0);
  return dashboard.stats.reimbursableMinor + mileageOutstanding;
}

// ── In-session local overlay for edits the mock API can't persist yet ──────

interface ReceiptEdit {
  comment?: string;
  totalMinor?: number;
}

const receiptEdits = new Map<string, ReceiptEdit>();

function mergeReceiptEdits(r: Receipt): Receipt {
  const edit = receiptEdits.get(r.id);
  if (!edit) return r;
  return {
    ...r,
    comment: edit.comment !== undefined ? edit.comment : r.comment,
    totalMinor: edit.totalMinor !== undefined ? edit.totalMinor : r.totalMinor,
  };
}

export function patchReceiptLocal(id: string, patch: ReceiptEdit): void {
  const existing = receiptEdits.get(id) ?? {};
  receiptEdits.set(id, { ...existing, ...patch });
}

// ── Capture flow: simulated extraction (no OCR backend yet) ────────────────

export interface DraftReceipt {
  photoUri: string;
  vendor: string;
  date: string;
  totalMinor: number;
  taxMinor: number;
  paymentBrand: string | null;
  paymentLast4: string | null;
  category: string;
  comment: string;
}

/**
 * Stands in for the real extraction call. Real extraction (see OCR_PLAN.md)
 * takes 3-8 seconds and sometimes longer — the design mockup's fixed 1.4s
 * timeout is not realistic, so this mirrors the real latency distribution
 * instead of faking a fast round-trip.
 */
export function simulateExtraction(photoUri: string, today: string): Promise<DraftReceipt> {
  const delayMs = 3000 + Math.random() * 5000; // 3-8s, matching real extraction
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        photoUri,
        vendor: "",
        date: today,
        totalMinor: 0,
        taxMinor: 0,
        paymentBrand: null,
        paymentLast4: null,
        category: mockListCategories()[0] ?? "Other",
        comment: "",
      });
    }, delayMs);
  });
}
