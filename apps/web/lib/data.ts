/**
 * Single wrapper around @rr/api (the real Supabase-backed implementation —
 * see PHASE1.md: "Do not import the backend package directly into
 * components"). Every screen and component in apps/web goes through this
 * module instead.
 *
 * Every function here is async, unlike the @rr/mock-api version this
 * replaced — Postgrest is a real network call. Screens read these through
 * the query hooks in lib/queries.ts, not by calling them directly.
 */

import * as api from "@rr/api";
import type { DashboardResponse, DistanceUnit, MileageTrip, MyPendingInvite, Receipt, ReimbursementStatus, Role, TeamResponse, WorkspaceInvite } from "@rr/shared";
import { persistActiveWorkspace } from "./activeWorkspace";

export type { CurrentUser, WorkspaceUser } from "@rr/api";

/** Anchored once at load — "today" doesn't change meaningfully within a session. */
export const TODAY = new Date().toISOString().slice(0, 10);
export const CURRENCIES = api.SUPPORTED_CURRENCIES;

/**
 * Personal-only, regardless of role — the Dashboard is "how am I doing",
 * the Team tab is where an owner/admin sees the whole workspace. Reads the
 * id off the local session (no extra network round trip) rather than
 * getCurrentUser(), which does a real join query just for this.
 */
export async function getDashboard(month?: string): Promise<DashboardResponse> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");
  return api.getDashboard(month, session.user.id);
}

export function listReceipts(
  opts: { month?: string | undefined; categoryName?: string | undefined; userId?: string | undefined; q?: string | undefined } = {},
): Promise<Receipt[]> {
  const clean: { month?: string; categoryName?: string; userId?: string; q?: string } = {};
  if (opts.month !== undefined) clean.month = opts.month;
  if (opts.categoryName !== undefined) clean.categoryName = opts.categoryName;
  if (opts.userId !== undefined) clean.userId = opts.userId;
  if (opts.q !== undefined) clean.q = opts.q;
  return api.listReceipts(clean);
}

export function getReceipt(id: string): Promise<Receipt | undefined> {
  return api.getReceipt(id);
}

/** Warns before saving what looks like an accidental double-submission — same vendor, date, and total already on record. */
export function findDuplicateReceipt(vendor: string, receiptDate: string | null, totalMinor: number): Promise<boolean> {
  return api.findDuplicateReceipt(vendor, receiptDate, totalMinor);
}

/** Exchanges a receipt's stored path for a short-lived URL actually usable in an <img>. */
export function getReceiptPhotoUrl(imagePath: string | null): Promise<string | null> {
  return api.getReceiptPhotoUrl(imagePath);
}

export function setReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): Promise<void> {
  return api.setReimbursementStatus(id, status, reason);
}

export function setCategory(id: string, categoryName: string): Promise<void> {
  return api.setCategory(id, categoryName);
}

/** `minor` must already be in the receipt's own currency — see @rr/api's setReclaimMinor. */
export function setReceiptReclaim(id: string, minor: number): Promise<void> {
  return api.setReclaimMinor(id, minor);
}

/** Only permitted while pending or rejected — see @rr/shared's canDeleteReceipt. Mirrors mobile's swipe-to-delete. */
export function deleteReceipt(id: string): Promise<boolean> {
  return api.deleteReceipt(id);
}

export function getTeam(month?: string): Promise<TeamResponse> {
  return api.getTeam(month);
}

export function listMileage(userId?: string): Promise<MileageTrip[]> {
  return api.listMileage(userId);
}

export function addMileageTrip(input: { tripDate: string; purpose: string; distance: number; distanceUnit: "mi" | "km" }): Promise<MileageTrip> {
  return api.addMileageTrip(input);
}

/** Only permitted while pending — same rule mobile's swipe-to-delete relies on. */
export function deleteMileageTrip(id: string): Promise<boolean> {
  return api.deleteMileageTrip(id);
}

export function setMileageReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): Promise<void> {
  return api.setMileageReimbursementStatus(id, status, reason);
}

export function listCategories(): Promise<string[]> {
  return api.listCategories();
}

export function addCategoryName(name: string): Promise<void> {
  return api.addCategoryName(name);
}

export function removeCategoryName(name: string): Promise<void> {
  return api.removeCategoryName(name);
}

export function getHomeCurrency(): Promise<string> {
  return api.getHomeCurrency();
}

/**
 * Workspace-wide default -- no editing UI for this anymore (removed from
 * Setup's Currency section per the user's request; every person gets their
 * own override from the per-user table instead, see setUserDisplayDistanceUnit/
 * setUserMileageRate). Still read here as the "Default (...)" fallback
 * shown in that table and by mobile.
 */
export function getDistanceUnit(): Promise<DistanceUnit> {
  return api.getDistanceUnit();
}

export function getMileageRateMilli(): Promise<number> {
  return api.getMileageRateMilli();
}

/** The caller's own effective rate -- their own per-user override if an admin set one, else the workspace default. See Profile page. */
export function getMyMileageRateMilli(): Promise<number> {
  return api.getMyMileageRateMilli();
}

export function getDailyApprovalRemindersEnabled(): Promise<boolean> {
  return api.getDailyApprovalRemindersEnabled();
}

/**
 * Personal, display-only overrides -- null means "use the workspace
 * default." Set only by an admin (see the Setup page's "User currency &
 * mileage" table / setUserDisplayCurrency below); this app's own Profile
 * page shows the effective value read-only -- see 0019_personal_display_prefs.sql.
 */
export function getMyDisplayPrefs(): Promise<{ currency: string | null; distanceUnit: DistanceUnit | null }> {
  return api.getMyDisplayPrefs();
}

/**
 * Live rate for re-expressing an already-fetched, workspace-currency amount
 * in the caller's personal display currency (see MyMileagePanel) -- never
 * the frozen scan-time rate stored on a receipt. Returns null on same-
 * currency or any failure -- fails open, a display nicety must never block
 * or crash a screen.
 */
export async function fetchDisplayRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  if (fromCurrency === toCurrency) return null;
  const session = await api.getSession();
  if (!session) return null;
  try {
    const res = await fetch("/api/fx-rate", {
      method: "POST",
      body: JSON.stringify({ from: fromCurrency, to: toCurrency }),
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.rate ?? null;
  } catch {
    return null;
  }
}

export function setDailyApprovalRemindersEnabled(enabled: boolean): Promise<void> {
  return api.setDailyApprovalRemindersEnabled(enabled);
}

export function setHomeCurrency(code: string): Promise<void> {
  return api.setHomeCurrency(code);
}

export function getWorkspaceName(): Promise<string> {
  return api.getWorkspaceName();
}

export function setWorkspaceName(name: string): Promise<void> {
  return api.setWorkspaceName(name);
}

export type { WorkspaceSummary } from "@rr/api";

export function listMyWorkspaces(): Promise<api.WorkspaceSummary[]> {
  return api.listMyWorkspaces();
}

/** Which workspace the switcher should show as selected — see lib/activeWorkspace.ts. */
export function getActiveWorkspaceId(): Promise<string> {
  return api.getCurrentWorkspaceId();
}

/**
 * Pins which workspace subsequent calls act on. Written to both localStorage
 * (see lib/activeWorkspace.ts -- an instant restore on this browser without
 * a network round trip) and profiles.active_workspace_id server-side, so
 * mobile's read-only workspace display (it has no localStorage of its own)
 * agrees with whatever was last picked here.
 */
export async function switchWorkspace(id: string): Promise<void> {
  await api.persistActiveWorkspaceId(id);
  persistActiveWorkspace(id);
}

export async function createWorkspace(name: string): Promise<string> {
  const id = await api.createWorkspace(name);
  await api.persistActiveWorkspaceId(id);
  persistActiveWorkspace(id);
  return id;
}

export function userName(id: string): Promise<string> {
  return api.userName(id);
}

export function getCurrentUser(): Promise<api.CurrentUser> {
  return api.getCurrentUser();
}

export function listUsers(): Promise<api.WorkspaceUser[]> {
  return api.listUsers();
}

export function setReimbursementAuthority(userId: string, canApprove: boolean, canProcess: boolean): Promise<void> {
  return api.setReimbursementAuthority(userId, canApprove, canProcess);
}

export function setReimbursementAssignments(approverUserId: string, employeeIds: string[]): Promise<void> {
  return api.setReimbursementAssignments(approverUserId, employeeIds);
}

/** Owner/admin setting a co-member's mileage rate override -- null falls back to the workspace default. */
export function setUserMileageRate(userId: string, rateMilli: number | null): Promise<void> {
  return api.setUserMileageRate(userId, rateMilli);
}

/** Owner/admin setting a co-member's personal display currency -- see the Setup page's user-currency table. */
export function setUserDisplayCurrency(userId: string, code: string | null): Promise<void> {
  return api.setUserDisplayCurrency(userId, code);
}

/** Owner/admin setting a co-member's personal display distance unit. */
export function setUserDisplayDistanceUnit(userId: string, unit: DistanceUnit | null): Promise<void> {
  return api.setUserDisplayDistanceUnit(userId, unit);
}

export function removeMember(userId: string): Promise<void> {
  return api.removeMember(userId);
}

export function listWorkspaceInvites(): Promise<WorkspaceInvite[]> {
  return api.listWorkspaceInvites();
}

export function inviteTeammate(email: string, role: Role): Promise<void> {
  return api.inviteTeammate(email, role);
}

export function revokeInvite(id: string): Promise<void> {
  return api.revokeInvite(id);
}

/**
 * Admin/owner-only: creates a brand-new account directly (no self-registration)
 * and returns the one-time temporary password to relay to that person, plus
 * whether the welcome email went out. See /api/team/provision-member.
 */
export async function provisionMember(email: string, role: Role): Promise<{ email: string; tempPassword: string; emailSent: boolean }> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/team/provision-member", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ email, role }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Could not create that account (HTTP ${res.status})`);
  }
  return body;
}

export function changePassword(newPassword: string): Promise<void> {
  return api.changePassword(newPassword);
}

/** Owner-only. Returns a Stripe Checkout URL to redirect the browser to. */
export async function createCheckoutSession(): Promise<{ url: string }> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/billing/create-checkout-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Could not start checkout (HTTP ${res.status})`);
  }
  return body;
}

/**
 * Best-effort — called after anything that changes workspace headcount
 * (creating or removing a member, accepting an invite) so Stripe's
 * subscription quantity stays accurate. A no-op if the workspace has no
 * subscription yet, so safe to call unconditionally.
 */
export async function syncSeats(): Promise<void> {
  const session = await api.getSession();
  if (!session) return;
  await fetch("/api/billing/sync-seats", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => {});
}

/** Owner/admin-only. Returns a Stripe Billing Portal URL for managing the card on file. */
export async function createPortalSession(): Promise<{ url: string }> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/billing/create-portal-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Could not open billing portal (HTTP ${res.status})`);
  }
  return body;
}

export interface Invoice {
  id: string;
  number: string | null;
  createdAt: string;
  amountPaidMinor: number;
  currency: string;
  status: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

/** Owner/admin-only. Straight from Stripe — no local invoice storage. */
export async function listInvoices(): Promise<Invoice[]> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/billing/invoices", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Could not load invoices (HTTP ${res.status})`);
  }
  return body.invoices;
}

/** Owner/admin-only, clears the one-time "trial ended early" notice for the whole workspace. */
export function dismissTrialEndedNotice(): Promise<void> {
  return api.dismissTrialEndedNotice();
}

/** Owner/admin-only. Immediate during a trial; cancel_at_period_end otherwise — see /api/billing/cancel-subscription. */
export async function cancelSubscription(): Promise<{ canceled: true; immediately: boolean; accessUntil?: string }> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/billing/cancel-subscription", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Could not cancel the subscription (HTTP ${res.status})`);
  }
  return body;
}

/** Owner/admin-only. Undoes a pending cancel_at_period_end before it takes effect. */
export async function resumeSubscription(): Promise<void> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/billing/resume-subscription", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Could not resume the subscription (HTTP ${res.status})`);
  }
}

export function requestPasswordReset(email: string): Promise<void> {
  return api.requestPasswordReset(email, `${window.location.origin}/reset-password`);
}

export function getMyPendingInvite(): Promise<MyPendingInvite | null> {
  return api.getMyPendingInvite();
}

export function acceptInvite(inviteId: string): Promise<void> {
  return api.acceptInvite(inviteId);
}

// ── Capture flow: upload-and-extract a receipt from the web app ──────────
//
// Mirrors apps/mobile/lib/data.ts's capture flow. Mobile is the only other
// caller of /api/extract — web just posts to it directly (same origin, no
// LAN address to resolve) and passes a browser File straight through
// (already a Blob — no RN/Hermes-style workaround needed here).

export interface DraftReceipt {
  vendor: string;
  date: string;
  totalMinor: number;
  taxMinor: number;
  paymentBrand: string | null;
  paymentLast4: string | null;
  category: string;
  comment: string;
  originalCurrency: string | null;
  originalTotalMinor: number | null;
  fxRate: number | null;
  fxRateDate: string | null;
  country: string | null;
}

/** The blank, user-fillable draft used when extraction fails or the user skips it — see mobile's identical reasoning. */
export function blankDraftReceipt(today: string): DraftReceipt {
  return {
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

/** Thrown instead of a plain Error when the photo itself is the problem — see /api/extract's `retake` flag. */
export class RetakePhotoError extends Error {}

export async function extractReceiptFromFile(file: File, today: string): Promise<DraftReceipt> {
  const session = await api.getSession();
  if (!session) throw new Error("Not signed in");

  const body = new FormData();
  body.append("image", file);

  const res = await fetch("/api/extract", {
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

export function uploadReceiptPhoto(file: File): Promise<string> {
  return api.uploadReceiptPhoto(file, file.type || "image/jpeg");
}

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
