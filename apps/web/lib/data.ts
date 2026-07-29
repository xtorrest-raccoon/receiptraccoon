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
import type { DashboardResponse, MileageTrip, MyPendingInvite, Receipt, ReimbursementStatus, Role, TeamResponse, WorkspaceInvite } from "@rr/shared";

export type { CurrentUser, WorkspaceUser } from "@rr/api";

/** Anchored once at load — "today" doesn't change meaningfully within a session. */
export const TODAY = new Date().toISOString().slice(0, 10);
export const CURRENCIES = api.SUPPORTED_CURRENCIES;

export function getDashboard(month?: string): Promise<DashboardResponse> {
  return api.getDashboard(month);
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

export function setHomeCurrency(code: string): Promise<void> {
  return api.setHomeCurrency(code);
}

export function getWorkspaceName(): Promise<string> {
  return api.getWorkspaceName();
}

export function setWorkspaceName(name: string): Promise<void> {
  return api.setWorkspaceName(name);
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
