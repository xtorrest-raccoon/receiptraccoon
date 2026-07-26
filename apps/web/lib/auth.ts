import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared by every API route that needs to know who's calling before doing
 * anything billed/expensive (OpenAI extraction, Google Maps distance) —
 * without this, a public deployment would let anyone burn spend with no
 * account at all.
 *
 * Returns a request-scoped Supabase client bound to the caller's own access
 * token — deliberately not @rr/api's singleton client (bound to whichever
 * client was last registered at import time; reusing it here would race
 * across concurrent requests in the same server process) and not a
 * service-role client (this one must respect RLS, scoped to the caller's
 * own identity, not bypass it).
 */
export async function requireUser(
  request: NextRequest,
): Promise<{ supabase: SupabaseClient; userId: string } | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } },
  );

  // getUser() re-validates the JWT against the auth server, unlike reading a
  // local session — the right check for a token a client just handed you.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { error: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }) };
  }

  return { supabase, userId: userData.user.id };
}
