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
import type { DashboardResponse, MileageTrip, Receipt, ReimbursementStatus, TeamResponse } from "@rr/shared";

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

export function setReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): Promise<void> {
  return api.setReimbursementStatus(id, status, reason);
}

export function setCategory(id: string, categoryName: string): Promise<void> {
  return api.setCategory(id, categoryName);
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

export function userName(id: string): Promise<string> {
  return api.userName(id);
}

export function getCurrentUser(): Promise<api.CurrentUser> {
  return api.getCurrentUser();
}

export function listUsers(): Promise<api.WorkspaceUser[]> {
  return api.listUsers();
}
