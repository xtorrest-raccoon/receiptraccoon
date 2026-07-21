/**
 * Single wrapper around @rr/mock-api.
 *
 * Per PHASE1.md: "Do not import @rr/mock-api directly into components." Every
 * screen and component in apps/web goes through this module instead, so that
 * swapping the mock for the real Supabase-backed API later touches one file.
 *
 * The mock API is a synchronous, in-memory, module-level singleton — that is
 * fine for this phase and lets pages call these functions directly from client
 * components without any loading state beyond "receipts.length === 0".
 */

import * as mockApi from "@rr/mock-api";
import type {
  DashboardResponse,
  MileageTrip,
  Receipt,
  ReimbursementStatus,
  TeamResponse,
} from "@rr/shared";

export type { MockUser } from "@rr/mock-api";

export const TODAY = mockApi.TODAY;
export const HOME_CURRENCY = mockApi.HOME_CURRENCY;
/** Same list mobile's Settings screen offers — see mock-api's FX_FROM_EUR. */
export const CURRENCIES = mockApi.SUPPORTED_CURRENCIES;

export function getDashboard(month?: string): DashboardResponse {
  return mockApi.getDashboard(month);
}

export function listReceipts(
  opts: { month?: string | undefined; categoryName?: string | undefined; userId?: string | undefined; q?: string | undefined } = {},
): Receipt[] {
  // Rebuilt without explicit `undefined` values: mock-api's own opts type
  // predates exactOptionalPropertyTypes-safe callers, so a value must be
  // omitted entirely rather than assigned undefined.
  const clean: { month?: string; categoryName?: string; userId?: string; q?: string } = {};
  if (opts.month !== undefined) clean.month = opts.month;
  if (opts.categoryName !== undefined) clean.categoryName = opts.categoryName;
  if (opts.userId !== undefined) clean.userId = opts.userId;
  if (opts.q !== undefined) clean.q = opts.q;
  return mockApi.listReceipts(clean);
}

export function getReceipt(id: string): Receipt | undefined {
  return mockApi.getReceipt(id);
}

export function setReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): void {
  mockApi.setReimbursementStatus(id, status, reason);
}

export function setCategory(id: string, categoryName: string): void {
  mockApi.setCategory(id, categoryName);
}

export function getTeam(month?: string): TeamResponse {
  return mockApi.getTeam(month);
}

export function listMileage(userId?: string): MileageTrip[] {
  return mockApi.listMileage(userId);
}

export function addMileageTrip(input: { tripDate: string; purpose: string; distance: number; distanceUnit: "mi" | "km" }): MileageTrip {
  return mockApi.addMileageTrip(input);
}

export function listCategories(): string[] {
  return mockApi.listCategories();
}

export function getHomeCurrency(): string {
  return mockApi.getHomeCurrency();
}

export function setHomeCurrency(code: string): void {
  mockApi.setHomeCurrency(code);
}

export function userName(id: string): string {
  return mockApi.userName(id);
}

export function getCurrentUser(): mockApi.MockUser {
  return mockApi.CURRENT_USER;
}

export function listUsers(): mockApi.MockUser[] {
  return mockApi.USERS;
}

export function setCurrentUser(id: string): void {
  mockApi.setCurrentUser(id);
}

/**
 * Local, in-memory management of the workspace category list. The mock API does
 * not model workspace-level category CRUD, so this small piece of state lives
 * here rather than being invented inside a component. Receipts in a removed
 * category are reassigned to "Other", mirroring the design's `removeCategory`.
 */
let categoryList: string[] = mockApi.listCategories();
const categoryListeners = new Set<() => void>();

function notifyCategoryListeners(): void {
  for (const l of categoryListeners) l();
}

export function getCategoryList(): string[] {
  return categoryList;
}

export function addCategoryName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || categoryList.includes(trimmed)) return;
  categoryList = [...categoryList, trimmed];
  notifyCategoryListeners();
}

export function removeCategoryName(name: string): void {
  categoryList = categoryList.filter((c) => c !== name);
  for (const r of mockApi.listReceipts({})) {
    if (r.categoryName === name) mockApi.setCategory(r.id, "Other");
  }
  notifyCategoryListeners();
}

export function subscribeCategoryList(listener: () => void): () => void {
  categoryListeners.add(listener);
  return () => categoryListeners.delete(listener);
}
