"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "@rr/api";
import { color } from "@rr/ui-tokens";
import { DataStoreProvider } from "../lib/store";
import { MobileTopBar, Sidebar } from "./Sidebar";
import { ReceiptDrawer } from "./ReceiptDrawer";
import { RejectionModal } from "./RejectionModal";
// Side-effect import: creates this app's Supabase client and registers it
// with @rr/api. Must run before any @rr/api call below.
import "../lib/supabase";

const LOGIN_PATH = "/login";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    getSession().then(setSession);
    return onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    if (session === "loading") return;
    const onLoginPage = pathname === LOGIN_PATH;
    if (!session && !onLoginPage) {
      router.replace(LOGIN_PATH);
    } else if (session && onLoginPage) {
      router.replace("/dashboard");
    }
  }, [session, pathname, router]);

  // The login page renders its own full-screen layout — no sidebar/top bar
  // around it, same reason the mobile app's (auth) group sits outside the
  // tab navigator.
  if (pathname === LOGIN_PATH) return <>{children}</>;

  if (session === "loading" || !session) {
    return <div style={{ minHeight: "100vh", background: color.bgWeb }} />;
  }

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
