/**
 * The single seam between the app and `@rr/mock-api`.
 *
 * Per PHASE1.md: "Wrap every call in a thin per-app data module ... so swapping to
 * the real API later touches one file, not every screen." No screen or component
 * may `import ... from "@rr/mock-api"` directly — everything goes through here.
 *
 * `extractReceiptFromPhoto` calls out to apps/web's /api/extract rather than
 * mock-api, since OCR (see OCR_PLAN.md) needs OPENAI_API_KEY held server-side —
 * that key must never reach this bundle. `blankDraftReceipt` is the fallback
 * when extraction fails or the user skips it.
 *
 * Receipt edits (comment, category, reclaim amount) go straight through to
 * mock-api's setters below, which mutate its RECEIPTS array in place — the same
 * store every aggregate (dashboard, owed-to-user, team, category breakdown)
 * reads from. An in-memory overlay kept only in this module used to stand in for
 * these, but every aggregate bypassed it by reading mock-api directly, so an
 * edited reclaim amount changed the receipt list yet left "Owed to you" showing
 * the old figure.
 */

import Constants from "expo-constants";
import {
  getDashboard as mockGetDashboard,
  listReceipts as mockListReceipts,
  getReceipt as mockGetReceipt,
  deleteReceipt as mockDeleteReceipt,
  addReceipt as mockAddReceipt,
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

/** Save a newly captured/filled-in receipt so it actually joins the workspace's records. */
export function addReceipt(input: {
  vendor: string;
  receiptDate: string | null;
  totalMinor: number;
  taxMinor: number;
  categoryName: string;
  comment: string;
  paymentBrand: string | null;
  paymentLast4: string | null;
  imagePath: string | null;
}): Receipt {
  return mockAddReceipt(input);
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

// ── Capture flow: real OCR extraction (packages/extraction via apps/web) ───

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
 * The blank, user-fillable draft used when extraction fails or the user
 * chooses to skip it — never fabricates a vendor/total, which would be
 * misleading in a receipts app.
 */
export function blankDraftReceipt(photoUri: string, today: string): DraftReceipt {
  return {
    photoUri,
    vendor: "",
    date: today,
    totalMinor: 0,
    taxMinor: 0,
    paymentBrand: null,
    paymentLast4: null,
    category: mockListCategories()[0] ?? "Other",
    comment: "",
  };
}

/**
 * OPENAI_API_KEY must never reach this bundle (OCR_PLAN.md §9), so extraction
 * runs server-side in apps/web's /api/extract and the phone uploads the photo
 * there. In dev, Expo already tells this app the LAN address it was served
 * from (Constants.expoConfig.hostUri) — reused here on port 3000 (Next's
 * default) so the phone doesn't need "localhost" (which would mean itself,
 * not the dev machine) or a manually typed IP. EXPO_PUBLIC_API_URL overrides
 * this for anything other than local dev (a tunnel, a deployed API).
 */
function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (!host) {
    throw new Error("Can't reach the extraction server — set EXPO_PUBLIC_API_URL.");
  }
  return `http://${host}:3000`;
}

/**
 * Thrown instead of a plain Error when the photo itself is the problem (too
 * blurry to read, or not a receipt at all) — see /api/extract's `retake` flag.
 * A second extraction attempt on the same photo can't fix this, so the caller
 * needs to route to "take another photo", not "retry" or "enter manually".
 */
export class RetakePhotoError extends Error {}

export async function extractReceiptFromPhoto(photoUri: string, today: string): Promise<DraftReceipt> {
  const body = new FormData();
  body.append("image", { uri: photoUri, name: "receipt.jpg", type: "image/jpeg" } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/api/extract`, { method: "POST", body });
  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    throw new Error(problem?.error ?? `Extraction failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (data.retake) {
    throw new RetakePhotoError(data.reason ?? "This photo is too unclear to read.");
  }
  return {
    photoUri,
    vendor: data.vendor ?? "",
    date: data.date ?? today,
    totalMinor: data.totalMinor ?? 0,
    taxMinor: data.taxMinor ?? 0,
    paymentBrand: data.paymentBrand ?? null,
    paymentLast4: data.paymentLast4 ?? null,
    category: data.category ?? (mockListCategories()[0] ?? "Other"),
    comment: "",
  };
}
