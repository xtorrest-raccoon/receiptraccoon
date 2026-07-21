"use client";

/**
 * Creates this app's Supabase client and hands it to @rr/api once, at import
 * time — mirroring how mock-api itself holds module-level state rather than
 * threading a client through every call. Import this once, for its side
 * effect, before anything else in @rr/api is used (see components/AppShell.tsx).
 *
 * "use client": the default auth storage adapter touches window.localStorage,
 * which doesn't exist during Next's server render pass.
 */
import { createClient } from "@supabase/supabase-js";
import { setSupabaseClient } from "@rr/api";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — check .env.local at the repo root.",
  );
}

export const supabase = createClient(url, anonKey);

setSupabaseClient(supabase);
