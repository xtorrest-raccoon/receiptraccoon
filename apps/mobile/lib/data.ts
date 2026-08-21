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
import {
  convertDashboardCurrency,
  convertMileageTripCurrency,
  convertOwedToUserCurrency,
  convertReceiptCurrency,
  formatMonthLabel,
  type DashboardResponse,
  type DistanceUnit,
  type MileageTrip,
  type MyPendingInvite,
  type OwedToUserSummary,
  type Receipt,
} from "@rr/shared";

export type { CurrentUser, WorkspaceUser } from "@rr/api";

/** Anchored once at load — "today" doesn't change meaningfully within a session. */
export const TODAY = new Date().toISOString().slice(0, 10);
export const CURRENT_MONTH = TODAY.slice(0, 7);

export function getCurrentUser(): Promise<api.CurrentUser> {
  return api.getCurrentUser();
}

export function signOut(): Promise<void> {
  return api.signOut();
}

/**
 * The actual password-setting screen only exists on the web app (see
 * SetPasswordForm) — not duplicated here, same reasoning as
 * FinishSetupScreen for admin-provisioned accounts. The emailed reset link
 * points at the web app's /reset-password instead of a mobile deep link.
 */
export function requestPasswordReset(email: string): Promise<void> {
  return api.requestPasswordReset(email, `${getApiBaseUrl()}/reset-password`);
}

/**
 * The signed-in user's own id, read from the local session (no network round
 * trip — supabase-js keeps the session in memory/AsyncStorage) rather than
 * getCurrentUser(), which does a real join query just for this.
 */
async function currentUserId(): Promise<string> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");
  return session.user.id;
}

/**
 * Always scoped to the caller's own receipts/trips, regardless of role — an
 * owner/admin's web Dashboard and Team page intentionally show the whole
 * workspace (that's where approving/reviewing everyone's claims happens),
 * but the phone is where you look at YOUR OWN spend, so it stays personal
 * even for an owner. See @rr/api's getDashboard for the userId parameter
 * this relies on.
 */
export async function getDashboard(month?: string): Promise<DashboardResponse> {
  const dashboard = await api.getDashboard(month, await currentUserId());
  const displayCurrency = await getDisplayCurrency();
  if (displayCurrency === dashboard.currency) return dashboard;
  const rate = await fetchDisplayRate(dashboard.currency, displayCurrency);
  if (rate === null) return dashboard;
  return convertDashboardCurrency(dashboard, displayCurrency, rate);
}

/**
 * Read-only here — renaming or switching workspaces only happens on the web
 * app (see Sidebar's WorkspaceSwitcher). Whichever workspace was last made
 * active there is what shows here, via @rr/api's server-side pin
 * (profiles.active_workspace_id) rather than anything stored locally.
 */
export function getWorkspaceName(): Promise<string> {
  return api.getWorkspaceName();
}

/**
 * Workspace home currency. Changing it re-expresses every amount, so screens must
 * re-read after setting it — that is what the focus/refresh keys are for.
 */
export function getHomeCurrency(): Promise<string> {
  return api.getHomeCurrency();
}

/** Distance unit for mileage. A workspace setting, edited only from the web app's Setup page — see SettingsSheet. */
export function getDistanceUnit(): Promise<DistanceUnit> {
  return api.getDistanceUnit();
}

/** Workspace mileage rate, per the current distance unit. Edited only from the web app's Setup page. */
export function getMileageRateMilli(): Promise<number> {
  return api.getMileageRateMilli();
}

/**
 * The rate MY trips actually use — my own per-user override if an
 * owner/admin set one, else the workspace default — AND the currency/unit
 * it's actually denominated in (my own display_currency/display_distance_unit
 * from Setup's user currency & mileage table, if set, else the workspace's own).
 */
export function getMyMileageRate(): Promise<{ rateMilli: number; currency: string; unit: DistanceUnit }> {
  return api.getMyMileageRate();
}

/** Whether the currently active workspace is the one the caller may actually submit receipts/mileage into -- see 0024_home_workspace.sql. */
export function isCurrentWorkspaceHome(): Promise<boolean> {
  return api.isCurrentWorkspaceHome();
}

/**
 * Personal, display-only overrides — null means "use the workspace
 * default." Read-only here, same reasoning as getWorkspaceName above:
 * edited only from the web app's Profile page (see 0019_personal_display_prefs.sql).
 */
export function getMyDisplayPrefs(): Promise<{ currency: string | null; distanceUnit: DistanceUnit | null }> {
  return api.getMyDisplayPrefs();
}

/** The currency every read function below actually displays amounts in — my own override, or the workspace default. */
export async function getDisplayCurrency(): Promise<string> {
  const prefs = await getMyDisplayPrefs();
  return prefs.currency ?? (await getHomeCurrency());
}

/** The distance unit screens should display trips in — my own override, or the workspace default. */
export async function getDisplayDistanceUnit(): Promise<DistanceUnit> {
  const prefs = await getMyDisplayPrefs();
  return prefs.distanceUnit ?? (await getDistanceUnit());
}

/**
 * Live rate for re-expressing an already-fetched, workspace-currency amount
 * in the caller's display currency — never the frozen scan-time rate stored
 * on a receipt. Fails open (returns null, meaning "show unconverted") on any
 * error, same as calculateMileageDistance's error handling below: a display
 * nicety must never block or crash a screen.
 */
async function postFxRate(fromCurrency: string, toCurrency: string, accessToken: string, date?: string): Promise<Response> {
  return fetch(`${getApiBaseUrl()}/api/fx-rate`, {
    method: "POST",
    body: JSON.stringify({ from: fromCurrency, to: toCurrency, ...(date ? { date } : {}) }),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
}

async function fetchRate(fromCurrency: string, toCurrency: string, date?: string): Promise<number | null> {
  if (fromCurrency === toCurrency) return null;
  try {
    const session = await api.getSession();
    if (!session) return null;
    let res = await postFxRate(fromCurrency, toCurrency, session.access_token, date);
    // A 401 here can mean the token had already rotated by the time this
    // request reached the server (getSession() can hand back a token that's
    // a beat behind an in-flight refresh) -- force a fresh one and retry once
    // before treating it as a real auth failure and fail-opening.
    if (res.status === 401) {
      const freshSession = await api.refreshSession();
      if (!freshSession) return null;
      res = await postFxRate(fromCurrency, toCurrency, freshSession.access_token, date);
    }
    if (!res.ok) return null;
    const data = await res.json();
    return data.rate ?? null;
  } catch {
    return null;
  }
}

async function fetchDisplayRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  return fetchRate(fromCurrency, toCurrency);
}

/**
 * For the Review receipt screen's manual currency picker: the rate as of
 * the receipt's OWN date, matching the same date-anchored-to-the-purchase
 * principle /api/extract's own conversion already uses, so a manual
 * correction is priced the same way an automatic one would have been —
 * never today's rate for a receipt from last week. Fails open (null) on
 * any error, same as every other rate lookup in this file: never block a
 * save over a display nicety, and never fabricate a rate.
 */
export async function fetchReceiptCurrencyRate(
  fromCurrency: string,
  toCurrency: string,
  receiptDate: string,
): Promise<number | null> {
  return fetchRate(fromCurrency, toCurrency, receiptDate);
}

/**
 * For screens that need to convert a standalone figure (a rate, not a
 * fetched Receipt/MileageTrip/DashboardResponse) into the caller's display
 * currency themselves — e.g. the Mileage tab's rate card, or the Settings
 * sheet. `rate` is null both when the display currency matches
 * `fromCurrency` (nothing to convert) and when the lookup fails (fail open).
 */
export async function getDisplayRate(fromCurrency: string): Promise<{ displayCurrency: string; rate: number | null }> {
  const displayCurrency = await getDisplayCurrency();
  if (displayCurrency === fromCurrency) return { displayCurrency, rate: null };
  return { displayCurrency, rate: await fetchDisplayRate(fromCurrency, displayCurrency) };
}

/** What a trip would be worth if saved now — same rate the save itself will use. */
export function estimateMileageAmountMinor(distance: number, unit: DistanceUnit): Promise<number> {
  return api.estimateMileageAmountMinor(distance, unit);
}

/**
 * Personal-only, same reasoning as getDashboard above. Deliberately NOT a
 * single blanket rate off receipts[0].currency -- a receipt keeps whatever
 * currency the workspace was set to at scan time (see this file's own
 * header on "never retroactively reconvert"), so a list can genuinely mix
 * currencies if the workspace's own currency was ever changed. One rate off
 * the first receipt would silently leave every OTHER currency's receipts
 * unconverted (or wrongly converted) whenever that first receipt happened
 * to already match the display currency.
 */
export async function listReceipts(opts: { month?: string; categoryName?: string; q?: string } = {}): Promise<Receipt[]> {
  const receipts = await api.listReceipts({ ...opts, userId: await currentUserId() });
  const displayCurrency = await getDisplayCurrency();
  const distinctCurrencies = Array.from(new Set(receipts.map((r) => r.currency))).filter((c) => c !== displayCurrency);
  if (distinctCurrencies.length === 0) return receipts;
  const rates = await Promise.all(distinctCurrencies.map((c) => fetchDisplayRate(c, displayCurrency)));
  const rateByCurrency = new Map(distinctCurrencies.map((c, i) => [c, rates[i]]));
  return receipts.map((r) => {
    const rate = rateByCurrency.get(r.currency);
    return rate != null ? convertReceiptCurrency(r, displayCurrency, rate) : r;
  });
}

export async function getReceipt(id: string): Promise<Receipt | undefined> {
  const receipt = await api.getReceipt(id);
  if (!receipt) return receipt;
  const displayCurrency = await getDisplayCurrency();
  if (displayCurrency === receipt.currency) return receipt;
  const rate = await fetchDisplayRate(receipt.currency, displayCurrency);
  if (rate === null) return receipt;
  return convertReceiptCurrency(receipt, displayCurrency, rate);
}

/** Warns before saving what looks like an accidental double-submission — same vendor, date, and total already on record. */
export function findDuplicateReceipt(vendor: string, receiptDate: string | null, totalMinor: number): Promise<boolean> {
  return api.findDuplicateReceipt(vendor, receiptDate, totalMinor);
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

/** The signed-in user's own pending invite, if any — see AcceptInviteModal. */
export function getMyPendingInvite(): Promise<MyPendingInvite | null> {
  return api.getMyPendingInvite();
}

/** Accepts an invite: migrates the caller's own membership, receipts and mileage trips onto the invite's workspace. */
export function acceptInvite(inviteId: string): Promise<void> {
  return api.acceptInvite(inviteId);
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
  originalCurrency?: string | null;
  originalTotalMinor?: number | null;
  fxRate?: number | null;
  fxRateDate?: string | null;
  country?: string | null;
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

/** Personal-only, same reasoning as getDashboard above. MileageTrip carries no currency field of its own — amountMinor is always in the workspace's. */
export async function listMileage(): Promise<MileageTrip[]> {
  const trips = await api.listMileage(await currentUserId());
  const [workspaceCurrency, displayCurrency] = await Promise.all([getHomeCurrency(), getDisplayCurrency()]);
  if (displayCurrency === workspaceCurrency) return trips;
  const rate = await fetchDisplayRate(workspaceCurrency, displayCurrency);
  if (rate === null) return trips;
  return trips.map((t) => convertMileageTripCurrency(t, workspaceCurrency, displayCurrency, rate));
}

export function addMileageTrip(input: {
  tripDate: string;
  purpose: string;
  distance: number;
  distanceUnit: DistanceUnit;
  /** Populated only for a trip entered via automatic (address-based) distance calculation. */
  startAddress?: string | null;
  endAddress?: string | null;
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

/** Months that have at least one of the caller's OWN receipts, oldest first — powers the month picker. */
export async function getAvailableMonths(): Promise<{ value: string; label: string }[]> {
  const all = await api.listReceipts({ userId: await currentUserId() });
  const months = Array.from(new Set(all.map((r) => (r.receiptDate ?? "").slice(0, 7)).filter(Boolean))).sort();
  return months.map((m) => ({ value: m, label: formatMonthLabel(m) }));
}

/**
 * "Owed to you" running balance — pending + approved receipts and mileage,
 * always the caller's own regardless of role (see getDashboard above for
 * why). No date restriction — see @rr/api's getOwedToUserSummary for why a
 * monthly scope would be wrong here.
 *
 * amountMinor and receiptCount are paired deliberately — see OwedToUserSummary.
 */
export async function getOwedToUserSummary(): Promise<OwedToUserSummary> {
  const owed = await api.getOwedToUserSummary(await currentUserId());
  const [workspaceCurrency, displayCurrency] = await Promise.all([getHomeCurrency(), getDisplayCurrency()]);
  if (displayCurrency === workspaceCurrency) return owed;
  const rate = await fetchDisplayRate(workspaceCurrency, displayCurrency);
  if (rate === null) return owed;
  return convertOwedToUserCurrency(owed, workspaceCurrency, displayCurrency, rate);
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
  /** Populated only when the receipt was printed in a different currency — see @rr/shared's Receipt type. */
  originalCurrency: string | null;
  originalTotalMinor: number | null;
  fxRate: number | null;
  fxRateDate: string | null;
  /** ISO 3166-1 alpha-2, detected from the receipt itself — see @rr/shared's Receipt type. */
  country: string | null;
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
    originalCurrency: null,
    originalTotalMinor: null,
    fxRate: null,
    fxRateDate: null,
    country: null,
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

export interface CalculatedDistance {
  distance: number;
  unit: DistanceUnit;
  originAddress: string;
  destinationAddress: string;
}

/**
 * Server-side lookup for the "Automatic" mileage entry mode — GOOGLE_MAPS_API_KEY
 * must never reach this bundle, same reasoning as OPENAI_API_KEY above, so this
 * posts JSON (no file, unlike extractReceiptFromPhoto) to apps/web's
 * /api/mileage-distance instead of calling Google directly.
 */
export async function calculateMileageDistance(
  startAddress: string,
  endAddress: string,
  unit: DistanceUnit,
): Promise<CalculatedDistance> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch(`${getApiBaseUrl()}/api/mileage-distance`, {
    method: "POST",
    body: JSON.stringify({ startAddress, endAddress, unit }),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? `Distance lookup failed (HTTP ${res.status})`);
  }
  return data as CalculatedDistance;
}

export async function extractReceiptFromPhoto(photoUri: string, today: string): Promise<DraftReceipt> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const body = new FormData();
  body.append("image", { uri: photoUri, name: "receipt.jpg", type: "image/jpeg" } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/api/extract`, {
    method: "POST",
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
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
    originalCurrency: data.originalCurrency ?? null,
    originalTotalMinor: data.originalTotalMinor ?? null,
    fxRate: data.fxRate ?? null,
    fxRateDate: data.fxRateDate ?? null,
    country: data.country ?? null,
  };
}
