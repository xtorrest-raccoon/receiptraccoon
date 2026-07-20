/**
 * The single seam between the app and `@rr/mock-api`.
 *
 * Per PHASE1.md: "Wrap every call in a thin per-app data module ... so swapping to
 * the real API later touches one file, not every screen." No screen or component
 * may `import ... from "@rr/mock-api"` directly — everything goes through here.
 *
 * One thing in this file is NOT a simple passthrough, because the real backend
 * isn't provisioned yet (see PHASE1.md, "Supabase is not provisioned yet"):
 *
 * `simulateExtraction` — there is no OCR endpoint yet (see OCR_PLAN.md /
 * schemas.ts's `ReceiptExtractionLoose`). This stands in for it with a realistic
 * delay and returns a blank, user-fillable draft rather than fabricating a fake
 * vendor/total, which would be misleading in a receipts app.
 *
 * Receipt edits (comment, category, reclaim amount) go straight through to
 * mock-api's setters below, which mutate its RECEIPTS array in place — the same
 * store every aggregate (dashboard, owed-to-user, team, category breakdown)
 * reads from. An in-memory overlay kept only in this module used to stand in for
 * these, but every aggregate bypassed it by reading mock-api directly, so an
 * edited reclaim amount changed the receipt list yet left "Owed to you" showing
 * the old figure.
 */

import {
  getDashboard as mockGetDashboard,
  listReceipts as mockListReceipts,
  getReceipt as mockGetReceipt,
  deleteReceipt as mockDeleteReceipt,
  listMileage as mockListMileage,
  getOwedToUserSummary as mockGetOwedToUser,
  addMileageTrip as mockAddMileageTrip,
  updateMileageTrip as mockUpdateMileageTrip,
  deleteMileageTrip as mockDeleteMileageTrip,
  listCategories as mockListCategories,
  setCategory as mockSetCategory,
  setComment as mockSetComment,
  setReclaimMinor as mockSetReclaimMinor,
  HOME_CURRENCY as MOCK_HOME_CURRENCY,
  getHomeCurrency as mockGetHomeCurrency,
  setHomeCurrency as mockSetHomeCurrency,
  getDistanceUnit as mockGetDistanceUnit,
  setDistanceUnit as mockSetDistanceUnit,
  getMileageRateMilli as mockGetRate,
  setMileageRateMilli as mockSetRate,
  estimateMileageAmountMinor as mockEstimateMileage,
  SUPPORTED_CURRENCIES,
  TODAY as MOCK_TODAY,
  CURRENT_USER,
} from "@rr/mock-api";
import {
  formatMonthLabel,
  type DashboardResponse,
  type OwedToUserSummary,
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

/**
 * Workspace home currency. Changing it re-expresses every amount, so screens must
 * re-read after setting it — that is what the focus/refresh keys are for.
 */
export function getHomeCurrency(): string {
  return mockGetHomeCurrency();
}

export function setHomeCurrency(code: string): void {
  mockSetHomeCurrency(code);
}

export const CURRENCIES = SUPPORTED_CURRENCIES;

/** Distance unit for mileage. A workspace setting, shared across screens. */
export function getDistanceUnit(): DistanceUnit {
  return mockGetDistanceUnit();
}

export function setDistanceUnit(unit: DistanceUnit): void {
  mockSetDistanceUnit(unit);
}

/** Workspace mileage rate, per the current distance unit. Edited from Settings. */
export function getMileageRateMilli(): number {
  return mockGetRate();
}

export function setMileageRateMilli(value: number): void {
  mockSetRate(value);
}

/** What a trip would be worth if saved now — same rate the save itself will use. */
export function estimateMileageAmountMinor(distance: number, unit: DistanceUnit): number {
  return mockEstimateMileage(distance, unit);
}

export function listReceipts(opts: { month?: string; categoryName?: string; q?: string } = {}): Receipt[] {
  return mockListReceipts(opts);
}

export function getReceipt(id: string): Receipt | undefined {
  return mockGetReceipt(id);
}

/** Persisted while the receipt is still pending — see canEditReceiptComment. */
export function setReceiptComment(id: string, comment: string): void {
  mockSetComment(id, comment);
}

/** Persisted while the receipt is still pending — see canEditReceiptCategory. */
export function setReceiptCategory(id: string, categoryName: string): void {
  mockSetCategory(id, categoryName);
}

/**
 * `minorHomeCurrency` must already be in the workspace's home currency — the
 * same units the receipt's own totalMinor/reclaimMinor are displayed in.
 * Persisted while the receipt is still pending — see canEditReceiptAmount.
 */
export function setReceiptReclaim(id: string, minorHomeCurrency: number): void {
  mockSetReclaimMinor(id, minorHomeCurrency);
}

/** Delete a receipt. Returns false when not permitted — see mock-api for the rule. */
export function deleteReceipt(id: string): boolean {
  return mockDeleteReceipt(id);
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

/** Edit a pending trip. Returns null when not permitted. */
export function updateMileageTrip(
  id: string,
  patch: { tripDate?: string; purpose?: string; distance?: number },
): MileageTrip | null {
  return mockUpdateMileageTrip(id, patch);
}

/** Delete a pending trip. Returns false when not permitted. */
export function deleteMileageTrip(id: string): boolean {
  return mockDeleteMileageTrip(id);
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

/**
 * "Owed to you" running balance — pending + approved receipts and mileage, in
 * whatever scope the signed-in user's role sees (own claims for a member, the
 * whole workspace for an owner/admin). No date restriction — see mock-api's
 * getOwedToUserSummary for why a monthly scope would be wrong here.
 *
 * amountMinor and receiptCount are paired deliberately — see OwedToUserSummary.
 */
export function getOwedToUserSummary(): OwedToUserSummary {
  return mockGetOwedToUser();
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
