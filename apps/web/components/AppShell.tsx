"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "@rr/api";
import { color } from "@rr/ui-tokens";
import { DataStoreProvider } from "../lib/store";
import { useCurrentUser } from "../lib/queries";
import { MobileTopBar, Sidebar } from "./Sidebar";
import { ReceiptDrawer } from "./ReceiptDrawer";
import { AddReceiptDrawer } from "./AddReceiptDrawer";
import { RejectionModal } from "./RejectionModal";
import { AcceptInviteBanner } from "./AcceptInviteBanner";
import { SetPasswordScreen } from "./SetPasswordScreen";
// Side-effect import: creates this app's Supabase client and registers it
// with @rr/api. Must run before any @rr/api call below.
import "../lib/supabase";

const LOGIN_PATH = "/login";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");
  // Lazy-initialized so Fast Refresh doesn't recreate the client (and its
  // cache) on every re-render of this component.
  const [queryClient] = useState(() => new QueryClient());

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

  return (
    <QueryClientProvider client={queryClient}>
      <AppShellBody pathname={pathname} session={session}>
        {children}
      </AppShellBody>
    </QueryClientProvider>
  );
}

function AppShellBody({
  pathname,
  session,
  children,
}: {
  pathname: string;
  session: Session | null | "loading";
  children: ReactNode;
}) {
  // The login page renders its own full-screen layout — no sidebar/top bar
  // around it, same reason the mobile app's (auth) group sits outside the
  // tab navigator.
  if (pathname === LOGIN_PATH) return <>{children}</>;

  if (session === "loading" || !session) {
    return <div style={{ minHeight: "100vh", background: color.bgWeb }} />;
  }

  return (
    <DataStoreProvider>
      <PasswordGate>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: color.bgWeb, color: color.text }}>
          <AcceptInviteBanner />
          <MobileTopBar />
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <Sidebar />
            <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-7" style={{ paddingBottom: 60 }}>
              {children}
            </div>
          </div>
        </div>
        <ReceiptDrawer />
        <AddReceiptDrawer />
        <RejectionModal />
      </PasswordGate>
    </DataStoreProvider>
  );
}

/**
 * Blocks everything below it — including the drawers/modals, not just the
 * sidebar — until an admin/owner-provisioned account has set its own
 * password. useCurrentUser() lives inside DataStoreProvider's QueryClient
 * boundary, so this has to sit here rather than in AppShell itself.
 */
function PasswordGate({ children }: { children: ReactNode }) {
  const { data: currentUser } = useCurrentUser();
  if (currentUser?.mustChangePassword) return <SetPasswordScreen />;
  return <>{children}</>;
}
