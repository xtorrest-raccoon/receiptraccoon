/**
 * TanStack Query hooks over lib/data.ts's async functions.
 *
 * Replaces the old pattern of calling lib/data.ts synchronously inside
 * useFocusEffect + useState — that only worked because mock-api was
 * in-memory and never actually async. Real reads are network calls, so every
 * screen now goes through useQuery here, and every write goes through the
 * matching mutation hook, which invalidates the affected query keys.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DistanceUnit } from "@rr/shared";
import * as data from "./data";

export function useCurrentUser() {
  return useQuery({ queryKey: ["currentUser"], queryFn: data.getCurrentUser });
}

export function useHomeCurrency() {
  return useQuery({ queryKey: ["homeCurrency"], queryFn: data.getHomeCurrency });
}

export function useDistanceUnit() {
  return useQuery({ queryKey: ["distanceUnit"], queryFn: data.getDistanceUnit });
}

export function useMileageRateMilli() {
  return useQuery({ queryKey: ["mileageRateMilli"], queryFn: data.getMileageRateMilli });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: data.listCategories });
}

export function useAvailableMonths() {
  return useQuery({ queryKey: ["availableMonths"], queryFn: data.getAvailableMonths });
}

export function useDashboard(month?: string) {
  return useQuery({ queryKey: ["dashboard", month ?? null], queryFn: () => data.getDashboard(month) });
}

export function useOwedToUser() {
  return useQuery({ queryKey: ["owedToUser"], queryFn: data.getOwedToUserSummary });
}

export function useReceipts(opts: { month?: string; categoryName?: string; q?: string } = {}) {
  return useQuery({ queryKey: ["receipts", opts], queryFn: () => data.listReceipts(opts) });
}

export function useReceipt(id: string | null) {
  return useQuery({
    queryKey: ["receipt", id],
    queryFn: () => data.getReceipt(id!),
    enabled: id !== null,
  });
}

export function useMileage() {
  return useQuery({ queryKey: ["mileage"], queryFn: data.listMileage });
}

/** Every read that a write anywhere in the app can affect. Coarse on purpose — see module doc. */
const ALL_QUERY_KEYS = [
  "dashboard",
  "receipts",
  "receipt",
  "mileage",
  "categories",
  "availableMonths",
  "homeCurrency",
  "distanceUnit",
  "mileageRateMilli",
  "owedToUser",
];

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ALL_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useAddReceipt() {
  const invalidateAll = useInvalidateAll();
  return useMutation({ mutationFn: data.addReceipt, onSuccess: invalidateAll });
}

export function useSetReceiptComment() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => data.setReceiptComment(id, comment),
    onSuccess: invalidateAll,
  });
}

export function useSetReceiptCategory() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, categoryName }: { id: string; categoryName: string }) => data.setReceiptCategory(id, categoryName),
    onSuccess: invalidateAll,
  });
}

export function useSetReceiptReclaim() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, minor }: { id: string; minor: number }) => data.setReceiptReclaim(id, minor),
    onSuccess: invalidateAll,
  });
}

export function useDeleteReceipt() {
  const invalidateAll = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => data.deleteReceipt(id), onSuccess: invalidateAll });
}

export function useSetHomeCurrency() {
  const invalidateAll = useInvalidateAll();
  return useMutation({ mutationFn: (code: string) => data.setHomeCurrency(code), onSuccess: invalidateAll });
}

export function useSetDistanceUnit() {
  const invalidateAll = useInvalidateAll();
  return useMutation({ mutationFn: (unit: DistanceUnit) => data.setDistanceUnit(unit), onSuccess: invalidateAll });
}

export function useSetMileageRateMilli() {
  const invalidateAll = useInvalidateAll();
  return useMutation({ mutationFn: (value: number) => data.setMileageRateMilli(value), onSuccess: invalidateAll });
}

export function useAddMileageTrip() {
  const invalidateAll = useInvalidateAll();
  return useMutation({ mutationFn: data.addMileageTrip, onSuccess: invalidateAll });
}

export function useUpdateMileageTrip() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { tripDate?: string; purpose?: string; distance?: number } }) =>
      data.updateMileageTrip(id, patch),
    onSuccess: invalidateAll,
  });
}

export function useDeleteMileageTrip() {
  const invalidateAll = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => data.deleteMileageTrip(id), onSuccess: invalidateAll });
}
