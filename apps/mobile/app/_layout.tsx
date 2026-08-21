import { useEffect, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { getSession, loadActiveWorkspaceId, onAuthStateChange } from "@rr/api";
import { AcceptInviteModal } from "../components/AcceptInviteModal";
import { FinishSetupScreen } from "../components/FinishSetupScreen";
import { useCurrentUser, useInvalidateAll } from "../lib/queries";
import { initI18n } from "../lib/i18n";
// Side-effect import: creates this app's Supabase client and registers it
// with @rr/api. Must run before any @rr/api call below.
import "../lib/supabase";

/**
 * Gates the whole tree until translations are loaded -- every screen below
 * calls useTranslation(), so rendering before this resolves would show raw
 * keys for one frame on cold start.
 */
function useI18nReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initI18n().then(() => setReady(true));
  }, []);
  return ready;
}

const queryClient = new QueryClient();

/**
 * Redirects to the login screen when signed out, and away from it when
 * signed in — the same "check session, redirect, render nothing meanwhile"
 * shape as capture/processing.tsx's existing redirect-when-missing-state
 * pattern, just keyed off auth instead of capture state.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    getSession().then(setSession);
    return onAuthStateChange(setSession);
  }, []);

  // Restores whichever workspace was last made active on web (see @rr/api's
  // loadActiveWorkspaceId) -- mobile has no switcher of its own, so this is
  // the only thing that keeps its read-only Workspace display (Settings
  // sheet) in agreement with web instead of always falling back to whichever
  // membership happens to sort first.
  useEffect(() => {
    if (session && session !== "loading") loadActiveWorkspaceId();
  }, [session]);

  // The effect above only runs at cold launch/sign-in -- everything it
  // affects (active workspace, and every workspace-wide setting an admin can
  // change from web's Setup, like the mileage rate) still comes from
  // long-lived, already-mounted queries that never refetch on their own
  // while the app just sits in the background. Re-sync every time the app
  // is brought back to the foreground, so a change made on web shows up here
  // without needing a full app restart.
  const invalidateAll = useInvalidateAll();
  useEffect(() => {
    if (!session || session === "loading") return;
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        loadActiveWorkspaceId();
        invalidateAll();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (session === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [session, segments, router]);

  if (session === "loading") return null;
  if (!session) return <>{children}</>;
  return <SignedInGate>{children}</SignedInGate>;
}

/**
 * Split out from AuthGate so useCurrentUser() only ever runs once a session
 * actually exists — otherwise it'd fire (and error, harmlessly but noisily)
 * on every cold load before sign-in, same reasoning as AcceptInviteModal
 * only ever being mounted here rather than unconditionally.
 */
function SignedInGate({ children }: { children: ReactNode }) {
  const { data: currentUser } = useCurrentUser();
  if (currentUser?.mustChangePassword) return <FinishSetupScreen />;
  return (
    <>
      <AcceptInviteModal />
      {children}
    </>
  );
}

export default function RootLayout() {
  const i18nReady = useI18nReady();
  if (!i18nReady) return null;

  return (
    // Required for any gesture-handler component to receive touches — without it
    // the swipe-to-delete rows silently do nothing.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={queryClient}>
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="receipt/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="country/[code]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="capture/processing" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="capture/confirm" options={{ animation: "slide_from_right", gestureEnabled: false }} />
          <Stack.Screen name="capture/saved" options={{ animation: "fade", gestureEnabled: false }} />
        </Stack>
      </AuthGate>
    </SafeAreaProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
