"use client";

/**
 * App-wide client state that has to survive across pages: the receipt detail
 * drawer (openable from a table row on any page), the rejection modal it can
 * spawn, and a version counter that lets pages know mutations happened
 * elsewhere so they re-read from lib/data.
 *
 * This never imports @rr/mock-api directly — only lib/data.ts.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ReimbursementStatus } from "@rr/shared";
import * as data from "./data";

interface RejectionModalState {
  receiptId: string;
  vendor: string;
  reason: string;
}

interface DataStoreValue {
  /** Bump after any mutation so consumers re-derive from lib/data. */
  version: number;
  bump: () => void;

  selectedReceiptId: string | null;
  openReceipt: (id: string) => void;
  closeReceipt: () => void;

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
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const openReceipt = useCallback((id: string) => setSelectedReceiptId(id), []);
  const closeReceipt = useCallback(() => setSelectedReceiptId(null), []);

  const [rejectionModal, setRejectionModal] = useState<RejectionModalState | null>(null);

  const requestReimbursementChange = useCallback(
    (receiptId: string, vendor: string, status: ReimbursementStatus, currentReason: string | null) => {
      if (status === "rejected") {
        setRejectionModal({ receiptId, vendor, reason: currentReason ?? "" });
      } else {
        data.setReimbursementStatus(receiptId, status);
        setVersion((v) => v + 1);
      }
    },
    [],
  );

  const setRejectionReason = useCallback((reason: string) => {
    setRejectionModal((m) => (m ? { ...m, reason } : m));
  }, []);

  const confirmRejection = useCallback(() => {
    setRejectionModal((m) => {
      if (m) data.setReimbursementStatus(m.receiptId, "rejected", m.reason.trim());
      return null;
    });
    setVersion((v) => v + 1);
  }, []);

  const cancelRejection = useCallback(() => setRejectionModal(null), []);

  const value = useMemo<DataStoreValue>(
    () => ({
      version,
      bump,
      selectedReceiptId,
      openReceipt,
      closeReceipt,
      rejectionModal,
      requestReimbursementChange,
      setRejectionReason,
      confirmRejection,
      cancelRejection,
    }),
    [
      version,
      bump,
      selectedReceiptId,
      openReceipt,
      closeReceipt,
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
