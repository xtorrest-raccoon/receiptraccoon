"use client";

/**
 * App-wide client state that has to survive across pages: the receipt detail
 * drawer (openable from a table row on any page) and the rejection modal it
 * can spawn.
 *
 * The `version` counter this used to carry is gone — that existed only to
 * tell useMemo-based reads in each screen "something changed, recompute",
 * which is exactly what TanStack Query's cache invalidation now does on its
 * own (see lib/queries.ts's mutation hooks). Reimbursement-status changes
 * route through useSetReimbursementStatus() here instead of calling
 * lib/data.ts directly, so they invalidate the same way any other mutation
 * does.
 *
 * This never imports @rr/api directly — only lib/data.ts / lib/queries.ts.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ReimbursementStatus } from "@rr/shared";
import { useSetReimbursementStatus } from "./queries";

interface RejectionModalState {
  receiptId: string;
  vendor: string;
  reason: string;
}

interface DataStoreValue {
  selectedReceiptId: string | null;
  openReceipt: (id: string) => void;
  closeReceipt: () => void;

  addReceiptOpen: boolean;
  openAddReceipt: () => void;
  closeAddReceipt: () => void;

  rejectionModal: RejectionModalState | null;
  /** Non-rejected targets apply immediately; "rejected" opens the reason modal. */
  requestReimbursementChange: (
    receiptId: string,
    vendor: string,
    status: ReimbursementStatus,
    currentReason: string | null,
  ) => void;
  setRejectionReason: (reason: string) => void;
  confirmRejection: () => void;
  cancelRejection: () => void;
}

const DataStoreContext = createContext<DataStoreValue | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const setReimbursementStatus = useSetReimbursementStatus();

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const openReceipt = useCallback((id: string) => setSelectedReceiptId(id), []);
  const closeReceipt = useCallback(() => setSelectedReceiptId(null), []);

  const [addReceiptOpen, setAddReceiptOpen] = useState(false);
  const openAddReceipt = useCallback(() => setAddReceiptOpen(true), []);
  const closeAddReceipt = useCallback(() => setAddReceiptOpen(false), []);

  const [rejectionModal, setRejectionModal] = useState<RejectionModalState | null>(null);

  const requestReimbursementChange = useCallback(
    (receiptId: string, vendor: string, status: ReimbursementStatus, currentReason: string | null) => {
      if (status === "rejected") {
        setRejectionModal({ receiptId, vendor, reason: currentReason ?? "" });
      } else {
        setReimbursementStatus.mutate({ id: receiptId, status });
      }
    },
    [setReimbursementStatus],
  );

  const setRejectionReason = useCallback((reason: string) => {
    setRejectionModal((m) => (m ? { ...m, reason } : m));
  }, []);

  const confirmRejection = useCallback(() => {
    setRejectionModal((m) => {
      if (m) setReimbursementStatus.mutate({ id: m.receiptId, status: "rejected", reason: m.reason.trim() });
      return null;
    });
  }, [setReimbursementStatus]);

  const cancelRejection = useCallback(() => setRejectionModal(null), []);

  const value = useMemo<DataStoreValue>(
    () => ({
      selectedReceiptId,
      openReceipt,
      closeReceipt,
      addReceiptOpen,
      openAddReceipt,
      closeAddReceipt,
      rejectionModal,
      requestReimbursementChange,
      setRejectionReason,
      confirmRejection,
      cancelRejection,
    }),
    [
      selectedReceiptId,
      openReceipt,
      closeReceipt,
      addReceiptOpen,
      openAddReceipt,
      closeAddReceipt,
      rejectionModal,
      requestReimbursementChange,
      setRejectionReason,
      confirmRejection,
      cancelRejection,
    ],
  );

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStore(): DataStoreValue {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error("useDataStore must be used within a DataStoreProvider");
  return ctx;
}
