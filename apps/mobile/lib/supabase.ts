/**
 * Creates this app's Supabase client and hands it to @rr/api once, at import
 * time — mirroring how mock-api itself holds module-level state rather than
 * threading a client through every call. Import this once, for its side
 * effect, before anything else in @rr/api is used (see app/_layout.tsx).
 *
 * AsyncStorage is the session storage adapter Supabase's own React Native
 * guide specifies — without it, sessions don't survive an app restart.
 */
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { setSupabaseClient } from "@rr/api";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check .env.local at the repo root.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No OAuth redirect flow yet — email/password only.
    detectSessionInUrl: false,
  },
});

setSupabaseClient(supabase);

// supabase-js's background refresh timer doesn't survive React Native
// backgrounding on its own — Supabase's own RN guide requires driving it off
// AppState, or a session that's been open a while (or was backgrounded past
// the access token's ~1hr lifetime) keeps handing out a stale access_token
// with no refresh actually happening, which surfaced as calls like
// /api/fx-rate silently 401ing and screens fail-open to the wrong currency.
if (AppState.currentState === "active") {
  supabase.auth.startAutoRefresh();
}
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
