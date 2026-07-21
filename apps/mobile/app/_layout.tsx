import { useEffect, useState, type ReactNode } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "@rr/api";
// Side-effect import: creates this app's Supabase client and registers it
// with @rr/api. Must run before any @rr/api call below.
import "../lib/supabase";

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
  return <>{children}</>;
}

export default function RootLayout() {
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
