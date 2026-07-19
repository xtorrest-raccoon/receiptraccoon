"use client";

import type { ReactNode } from "react";
import { color } from "@rr/ui-tokens";
import { DataStoreProvider } from "../lib/store";
import { MobileTopBar, Sidebar } from "./Sidebar";
import { ReceiptDrawer } from "./ReceiptDrawer";
import { RejectionModal } from "./RejectionModal";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DataStoreProvider>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: color.bgWeb, color: color.text }}>
        <MobileTopBar />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar />
          <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-7" style={{ paddingBottom: 60 }}>
            {children}
          </div>
        </div>
      </div>
      <ReceiptDrawer />
      <RejectionModal />
    </DataStoreProvider>
  );
}
