"use client";

/**
 * TanStack Query hooks over lib/data.ts's async functions.
 *
 * Replaces the old pattern of calling lib/data.ts synchronously inside
 * useMemo, keyed on lib/store.tsx's manual `version` counter — that only
 * worked because mock-api was in-memory and never actually async. Real reads
 * are network calls, so every screen now goes through useQuery here, and
 * every write goes through the matching mutation hook, which invalidates the
 * affected query keys instead of bumping a version counter.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReimbursementStatus } from "@rr/shared";
import * as data from "./data";

export function useCurrentUser() {
  return useQuery({ queryKey: ["currentUser"], queryFn: data.getCurrentUser });
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: data.listUsers });
}

export function useHomeCurrency() {
  return useQuery({ queryKey: ["homeCurrency"], queryFn: data.getHomeCurrency });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: data.listCategories });
}

export function useDashboard(month?: string) {
  return useQuery({ queryKey: ["dashboard", month ?? null], queryFn: () => data.getDashboard(month) });
}

export function useTeam(month?: string) {
  return useQuery({ queryKey: ["team", month ?? null], queryFn: () => data.getTeam(month) });
}

export function useReceipts(
  opts: { month?: string | undefined; categoryName?: string | undefined; userId?: string | undefined; q?: string | undefined } = {},
) {
  return useQuery({ queryKey: ["receipts", opts], queryFn: () => data.listReceipts(opts) });
}

export function useReceipt(id: string | null) {
  return useQuery({
    queryKey: ["receipt", id],
    queryFn: () => data.getReceipt(id!),
    enabled: id !== null,
  });
}

/** Signed URLs expire (1hr — see @rr/api), so this is intentionally excluded from the coarse invalidateAll sweep below; it just re-fetches on its own schedule. */
export function useReceiptPhotoUrl(imagePath: string | null) {
  return useQuery({
    queryKey: ["receiptPhotoUrl", imagePath],
    queryFn: () => data.getReceiptPhotoUrl(imagePath),
    enabled: imagePath !== null,
    staleTime: 30 * 60 * 1000,
  });
}

export function useMileage(userId?: string) {
  return useQuery({ queryKey: ["mileage", userId ?? null], queryFn: () => data.listMileage(userId) });
}

/** Every read that a write anywhere in the app can affect. Coarse on purpose — see module doc. */
const ALL_QUERY_KEYS = ["dashboard", "team", "receipts", "receipt", "mileage", "categories", "homeCurrency"];

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ALL_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useSetReimbursementStatus() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: ReimbursementStatus; reason?: string }) =>
      data.setReimbursementStatus(id, status, reason),
    onSuccess: invalidateAll,
  });
}

export function useSetCategory() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, categoryName }: { id: string; categoryName: string }) => data.setCategory(id, categoryName),
    onSuccess: invalidateAll,
  });
}

export function useSetHomeCurrency() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (code: string) => data.setHomeCurrency(code),
    onSuccess: invalidateAll,
  });
}

export function useAddMileageTrip() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { tripDate: string; purpose: string; distance: number; distanceUnit: "mi" | "km" }) =>
      data.addMileageTrip(input),
    onSuccess: invalidateAll,
  });
}

export function useAddCategoryName() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (name: string) => data.addCategoryName(name),
    onSuccess: invalidateAll,
  });
}

export function useRemoveCategoryName() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (name: string) => data.removeCategoryName(name),
    onSuccess: invalidateAll,
  });
}
