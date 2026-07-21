/**
 * The single seam between the app and `@rr/api` (the real Supabase-backed
 * implementation).
 *
 * Per PHASE1.md: "Wrap every call in a thin per-app data module ... so swapping to
 * the real API later touches one file, not every screen." No screen or component
 * may import the backend package directly — everything goes through here.
 *
 * Every function is async, unlike the @rr/mock-api version this replaced —
 * Postgrest is a real network call. Screens read these through the query
 * hooks in lib/queries.ts, not by calling them directly.
 *
 * `extractReceiptFromPhoto` calls out to apps/web's /api/extract rather than
 * @rr/api, since OCR (see OCR_PLAN.md) needs OPENAI_API_KEY held server-side —
 * that key must never reach this bundle. `blankDraftReceipt` is the fallback
 * when extraction fails or the user skips it.
 */

import Constants from "expo-constants";
import { File } from "expo-file-system";
import * as api from "@rr/api";
import { formatMonthLabel, type DashboardResponse, type DistanceUnit, type MileageTrip, type OwedToUserSummary, type Receipt } from "@rr/shared";

export type { CurrentUser, WorkspaceUser } from "@rr/api";

/** Anchored once at load — "today" doesn't change meaningfully within a session. */
export const TODAY = new Date().toISOString().slice(0, 10);
export const CURRENT_MONTH = TODAY.slice(0, 7);
export const CURRENCIES = api.SUPPORTED_CURRENCIES;

export function getCurrentUser(): Promise<api.CurrentUser> {
  return api.getCurrentUser();
}

export function getDashboard(month?: string): Promise<DashboardResponse> {
  return api.getDashboard(month);
}

/**
 * Workspace home currency. Changing it re-expresses every amount, so screens must
 * re-read after setting it — that is what the focus/refresh keys are for.
 */
export function getHomeCurrency(): Promise<string> {
  return api.getHomeCurrency();
}

export function setHomeCurrency(code: string): Promise<void> {
  return api.setHomeCurrency(code);
}

/** Distance unit for mileage. A workspace setting, shared across screens. */
export function getDistanceUnit(): Promise<DistanceUnit> {
  return api.getDistanceUnit();
}

export function setDistanceUnit(unit: DistanceUnit): Promise<void> {
  return api.setDistanceUnit(unit);
}

/** Workspace mileage rate, per the current distance unit. Edited from Settings. */
export function getMileageRateMilli(): Promise<number> {
  return api.getMileageRateMilli();
}

export function setMileageRateMilli(value: number): Promise<void> {
  return api.setMileageRateMilli(value);
}

/** What a trip would be worth if saved now — same rate the save itself will use. */
export function estimateMileageAmountMinor(distance: number, unit: DistanceUnit): Promise<number> {
  return api.estimateMileageAmountMinor(distance, unit);
}

export function listReceipts(opts: { month?: string; categoryName?: string; q?: string } = {}): Promise<Receipt[]> {
  return api.listReceipts(opts);
}

export function getReceipt(id: string): Promise<Receipt | undefined> {
  return api.getReceipt(id);
}

/**
 * Uploads a local photo (e.g. a capture cache URI) to Supabase Storage and
 * returns the storage PATH to store on the receipt — not the local URI, which
 * only exists on this device, and not a URL either, since the bucket is
 * private (see @rr/api's uploadReceiptPhoto).
 *
 * Reads the file directly via expo-file-system's File.bytes() rather than
 * fetch(localUri).blob() — that silently produced a 0-byte blob for a local
 * file:// URI under Hermes (a real bug caught live: the upload "succeeded"
 * and the receipt saved fine, but the stored photo was empty).
 */
export async function uploadReceiptPhoto(localUri: string): Promise<string> {
  const bytes = await new File(localUri).bytes();
  return api.uploadReceiptPhoto(bytes, "image/jpeg");
}

/** Exchanges a receipt's stored path for a short-lived URL actually usable in an <Image>. */
export function getReceiptPhotoUrl(imagePath: string | null): Promise<string | null> {
  return api.getReceiptPhotoUrl(imagePath);
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
}): Promise<Receipt> {
  return api.addReceipt(input);
}

/** Persisted while the receipt is still pending — see canEditReceiptComment. */
export function setReceiptComment(id: string, comment: string): Promise<void> {
  return api.setComment(id, comment);
}

/** Persisted while the receipt is still pending — see canEditReceiptCategory. */
export function setReceiptCategory(id: string, categoryName: string): Promise<void> {
  return api.setCategory(id, categoryName);
}

/**
 * `minorHomeCurrency` must already be in the workspace's home currency — the
 * same units the receipt's own totalMinor/reclaimMinor are displayed in.
 * Persisted while the receipt is still pending — see canEditReceiptAmount.
 */
export function setReceiptReclaim(id: string, minorHomeCurrency: number): Promise<void> {
  return api.setReclaimMinor(id, minorHomeCurrency);
}

/** Delete a receipt. Returns false when not permitted — see @rr/api for the rule. */
export function deleteReceipt(id: string): Promise<boolean> {
  return api.deleteReceipt(id);
}

export function listMileage(): Promise<MileageTrip[]> {
  return api.listMileage();
}

export function addMileageTrip(input: {
  tripDate: string;
  purpose: string;
  distance: number;
  distanceUnit: DistanceUnit;
}): Promise<MileageTrip> {
  return api.addMileageTrip(input);
}

/** Edit a pending trip. Returns null when not permitted. */
export function updateMileageTrip(
  id: string,
  patch: { tripDate?: string; purpose?: string; distance?: number },
): Promise<MileageTrip | null> {
  return api.updateMileageTrip(id, patch);
}

/** Delete a pending trip. Returns false when not permitted. */
export function deleteMileageTrip(id: string): Promise<boolean> {
  return api.deleteMileageTrip(id);
}

export function listCategories(): Promise<string[]> {
  return api.listCategories();
}

/** Months that have at least one receipt, oldest first — powers the month picker. */
export async function getAvailableMonths(): Promise<{ value: string; label: string }[]> {
  const all = await api.listReceipts({});
  const months = Array.from(new Set(all.map((r) => (r.receiptDate ?? "").slice(0, 7)).filter(Boolean))).sort();
  return months.map((m) => ({ value: m, label: formatMonthLabel(m) }));
}

/**
 * "Owed to you" running balance — pending + approved receipts and mileage, in
 * whatever scope the signed-in user's role sees (own claims for a member, the
 * whole workspace for an owner/admin). No date restriction — see @rr/api's
 * getOwedToUserSummary for why a monthly scope would be wrong here.
 *
 * amountMinor and receiptCount are paired deliberately — see OwedToUserSummary.
 */
export function getOwedToUserSummary(): Promise<OwedToUserSummary> {
  return api.getOwedToUserSummary();
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
 * misleading in a receipts app. "Other" is always a valid category — every
 * workspace is seeded with it (see 0001_init.sql's handle_new_user).
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
    category: "Other",
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
    category: data.category ?? "Other",
    comment: "",
  };
}
