/**
 * Creates this app's Supabase client and hands it to @rr/api once, at import
 * time — mirroring how mock-api itself holds module-level state rather than
 * threading a client through every call. Import this once, for its side
 * effect, before anything else in @rr/api is used (see app/_layout.tsx).
 *
 * AsyncStorage is the session storage adapter Supabase's own React Native
 * guide specifies — without it, sessions don't survive an app restart.
 */
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
