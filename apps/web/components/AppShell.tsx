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
import { TrialEndedBanner } from "./TrialEndedBanner";
import { StatusChangeErrorBanner } from "./StatusChangeErrorBanner";
import { SetPasswordScreen } from "./SetPasswordScreen";
import { BillingGate } from "./BillingGate";
// Side-effect import: creates this app's Supabase client and registers it
// with @rr/api. Must run before any @rr/api call below.
import "../lib/supabase";
import { initActiveWorkspace } from "../lib/activeWorkspace";

// Restores whichever workspace was last picked (see the workspace switcher
// in Sidebar.tsx) before any @rr/api call that resolves "the current
// workspace" runs.
initActiveWorkspace();

const LOGIN_PATH = "/login";
// Reached via the emailed recovery link, which briefly has no session at all
// (Supabase is still processing the token from the URL) and then a recovery
// session once it has — exempt from both halves of the normal redirect rule
// below, since neither "no session -> /login" nor "has session -> /dashboard"
// is right while someone's in the middle of resetting their password.
const RESET_PASSWORD_PATH = "/reset-password";
// The public marketing page — same "signed-out visitors stay, signed-in
// visitors get bounced to the app" treatment as the login page itself.
const LANDING_PATH = "/";
// Privacy/Terms/Support -- linked from the landing page's footer, from
// mobile's Settings sheet, and handed to App Store Connect/Google Play as
// the required policy URLs. Must render for EVERYONE, signed in or not --
// unlike the landing page, a signed-in visitor should stay here too rather
// than get bounced to /dashboard (someone reading the privacy policy from
// inside the app shouldn't be redirected away from it).
const STANDALONE_PATHS = new Set(["/privacy", "/terms", "/support"]);
const PUBLIC_PATHS = new Set([LOGIN_PATH, LANDING_PATH]);

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
    if (session === "loading" || pathname === RESET_PASSWORD_PATH || STANDALONE_PATHS.has(pathname)) return;
    const onPublicPath = PUBLIC_PATHS.has(pathname);
    if (!session && !onPublicPath) {
      router.replace(LOGIN_PATH);
    } else if (session && onPublicPath) {
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
  // tab navigator. Reset-password, the landing page, and Privacy/Terms/
  // Support are the same shape, for the same reason — the latter three also
  // need to render for a SIGNED-IN visitor too (see the effect above),
  // unlike the landing page which bounces them to /dashboard instead.
  if (pathname === LOGIN_PATH || pathname === RESET_PASSWORD_PATH || pathname === LANDING_PATH || STANDALONE_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  if (session === "loading" || !session) {
    return <div style={{ minHeight: "100vh", background: color.bgWeb }} />;
  }

  return (
    <DataStoreProvider>
      <BillingGate>
        <PasswordGate>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: color.bgWeb, color: color.text }}>
            <TrialEndedBanner />
            <AcceptInviteBanner />
            <StatusChangeErrorBanner />
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
      </BillingGate>
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
