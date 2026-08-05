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

  // getUser(token) re-validates the JWT against the auth server, unlike
  // reading a local session — the right check for a token a client just
  // handed you. Deliberately a PLAIN client with no global Authorization
  // header override: gotrue-js's getUser() throws AuthSessionMissingError
  // when this client has persistSession: false and no session of its own,
  // even when a jwt is passed explicitly and even when that jwt is valid —
  // the global header only ever covered PostgREST/Storage calls, not this
  // gotrue-js method, and its mere presence was enough to trip that check.
  const validator = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await validator.auth.getUser(token);
  if (userErr || !userData.user) {
    return { error: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }) };
  }

  // A separate client, scoped to the caller's own token via the global
  // header, for the RLS-respecting queries the caller actually returns —
  // this one is never asked to validate a session itself.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { supabase, userId: userData.user.id };
}

/**
 * The workspace + role an API route should act on for this caller. Someone
 * can belong to more than one workspace (see 0017_organizations.sql), so
 * this reads profiles.active_workspace_id -- the same column the web app
 * writes on every workspace switch (see persistActiveWorkspaceId in
 * packages/api) -- rather than grabbing whichever workspace_members row
 * happens to sort first, which silently ignores which workspace is open in
 * the UI. Falls back to an arbitrary membership when active_workspace_id is
 * unset (mobile never writes it) or stale (removed from that workspace
 * since it was last set).
 */
export async function getActiveMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ workspaceId: string; role: string } | null> {
  const toResult = (row: { workspace_id: string; role: string } | null) =>
    row ? { workspaceId: row.workspace_id, role: row.role } : null;

  const { data: profile } = await supabase.from("profiles").select("active_workspace_id").eq("id", userId).single();
  const activeId = (profile as { active_workspace_id: string | null } | null)?.active_workspace_id;

  if (activeId) {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", userId)
      .eq("workspace_id", activeId)
      .maybeSingle();
    if (data) return toResult(data as { workspace_id: string; role: string });
  }

  const { data } = await supabase.from("workspace_members").select("workspace_id, role").eq("user_id", userId).limit(1).single();
  return toResult(data as { workspace_id: string; role: string } | null);
}
