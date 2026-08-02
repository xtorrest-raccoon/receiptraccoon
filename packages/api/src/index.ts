/**
 * Real, Supabase-backed implementation with the same function names/shapes as
 * @rr/mock-api, per PHASE1.md's stated contract for apps/*\/lib/data.ts:
 * "swapping to the real API later touches one file, not every screen."
 *
 * Every function is async (Postgrest is a real network call, unlike mock-api's
 * in-memory arrays) and relies on the RLS policies already defined in
 * packages/db/migrations/0001_init.sql for scoping — there is no manual
 * visibleReceipts()-style filtering here; the database does it.
 *
 * Derived data (dashboard stats, team rollups) calls the exact same pure
 * aggregation functions mock-api now uses (packages/shared/src/aggregate.ts),
 * on rows fetched from Postgres instead of the in-memory arrays.
 *
 * Currency model differs from mock-api on purpose: mock-api stores everything
 * in EUR and re-expresses it in the workspace's home currency at read time
 * (its toHome()/fromHome()), so changing the currency setting instantly
 * re-labels every past amount. The real schema stores receipts already in the
 * home currency at write time (0001_init.sql: "Home-currency amounts. All
 * reporting reads these.") — changing the setting going forward does not
 * retroactively reconvert history. That is the actually-intended design (see
 * DESIGN_V2_DELTA.md §4.1's frozen-fx-rate reasoning), not a shortcut taken
 * here.
 */

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  MI_TO_KM,
  canDeleteReceipt,
  computeCategoryBreakdown,
  computeMonthPacing,
  computeReimbursable,
  computeTeamMemberSummaries,
  computeWeeklySpend,
  daysBetween,
  inMonth,
  isOutstanding,
  mileageAmountForTrip,
  reclaimMinor,
  type BudgetTip,
  type DashboardResponse,
  type DistanceUnit,
  type MileageTrip,
  type MyPendingInvite,
  type Receipt,
  type ReimbursementStatus,
  type Role,
  type TeamResponse,
  type OwedToUserSummary,
  type WorkspaceInvite,
} from "@rr/shared";

// ── client wiring ────────────────────────────────────────────────────────
//
// The client is created per-app (env var prefixes and session storage differ
// between Next.js and Expo — see apps/*/lib/supabase.ts) and handed in once at
// startup, mirroring how mock-api itself holds module-level state
// (CURRENT_USER, RECEIPTS, homeCurrency) rather than threading it through
// every call.

let supabase: SupabaseClient | null = null;

export function setSupabaseClient(client: SupabaseClient): void {
  supabase = client;
}

function client(): SupabaseClient {
  if (!supabase) {
    throw new Error("@rr/api: setSupabaseClient() must be called before any other @rr/api function.");
  }
  return supabase;
}

// ── auth ─────────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string, displayName?: string) {
  const { data, error } = await client().auth.signUp(
    displayName
      ? { email, password, options: { data: { full_name: displayName } } }
      : { email, password },
  );
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

/**
 * Sets a real password for an admin/owner-provisioned account and clears
 * mustChangePassword — the two happen together so the flag can never end up
 * cleared without an actual password change (see 0008_admin_provisioned_accounts.sql).
 */
/**
 * Sends the "reset your password" email — same Supabase mechanism as the
 * forced-password-change flow's underlying auth, just self-service instead
 * of admin-provisioned. redirectTo must be an allow-listed URL in Supabase's
 * Auth settings (the web app's own domain already is, from setting up
 * invites/confirmation earlier) — clicking the emailed link lands there with
 * a temporary recovery session, which changePassword() below then uses.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function changePassword(newPassword: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error: pwError } = await client().auth.updateUser({ password: newPassword });
  if (pwError) throw pwError;
  const { error: profileError } = await client().from("profiles").update({ must_change_password: false }).eq("id", userId);
  if (profileError) throw profileError;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await client().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = client().auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

async function getCurrentUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return session.user.id;
}

// A caller can now belong to more than one workspace (see 0017_organizations.sql),
// so something has to say which one every other call in this module acts on.
// The host app pins it via setActiveWorkspaceId() -- web persists the choice
// across reloads (see apps/web/lib/data.ts); mobile never calls this, so it
// keeps the pre-multi-workspace fallback below (whichever membership sorts
// first) unchanged.
let activeWorkspaceId: string | null = null;

export function setActiveWorkspaceId(id: string | null): void {
  activeWorkspaceId = id;
}

export async function getCurrentWorkspaceId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (activeWorkspaceId) {
    // Re-verify membership rather than trusting the pinned id blindly --
    // it can go stale (e.g. removed from that workspace since the browser
    // last stored it), and a removed member's requests should fall back to
    // one they still belong to, not silently 403 on every call.
    const { data } = await client()
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("workspace_id", activeWorkspaceId)
      .maybeSingle();
    if (data) return activeWorkspaceId;
  }

  const { data, error } = await client()
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error) throw error;
  return (data as { workspace_id: string }).workspace_id;
}

/**
 * The one workspace the caller may actually submit receipts/mileage into --
 * see 0024_home_workspace.sql. Someone administering a second workspace
 * (an owner who created it via createWorkspace) can toggle into it and
 * manage settings there, but this stays pointing at their original one;
 * the RLS policies on receipts/mileage_trips enforce the same rule
 * server-side, this is just for the UI to proactively hide/disable
 * "Add receipt"/"Log a trip" rather than let someone hit a raw RLS error.
 */
export async function getHomeWorkspaceId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await client().from("profiles").select("home_workspace_id").eq("id", userId).single();
  if (error) throw error;
  return (data as { home_workspace_id: string | null }).home_workspace_id;
}

/** Whether the CURRENTLY ACTIVE workspace is the caller's home one -- see getHomeWorkspaceId. */
export async function isCurrentWorkspaceHome(): Promise<boolean> {
  const [currentId, homeId] = await Promise.all([getCurrentWorkspaceId(), getHomeWorkspaceId()]);
  return homeId === null || homeId === currentId;
}

/**
 * Writes the choice to profiles.active_workspace_id so every client reading
 * this caller's profile agrees on it (mobile has no localStorage of its
 * own -- see loadActiveWorkspaceId below). Also updates the in-memory pin
 * immediately, same as setActiveWorkspaceId, so the caller doesn't need a
 * round trip before subsequent calls in this session act on the new one.
 */
export async function persistActiveWorkspaceId(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await client().from("profiles").update({ active_workspace_id: id }).eq("id", userId);
  if (error) throw error;
  setActiveWorkspaceId(id);
}

/**
 * Restores the in-memory pin from profiles.active_workspace_id at session
 * start. Mobile has no other source for this -- it never had a local pin of
 * its own -- so this is what lets it show the same active workspace an admin
 * last switched to on web (read-only there; see mobile's Settings sheet).
 * Membership is re-verified the same way getCurrentWorkspaceId does, since
 * the stored id can go stale (removed from that workspace since it was set).
 */
export async function loadActiveWorkspaceId(): Promise<void> {
  const userId = await getCurrentUserId();
  const { data: profile, error } = await client()
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const stored = (profile as { active_workspace_id: string | null }).active_workspace_id;
  if (!stored) return;

  const { data: membership } = await client()
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("workspace_id", stored)
    .maybeSingle();
  if (membership) setActiveWorkspaceId(stored);
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: Role;
}

/** Every workspace the caller belongs to, for the workspace switcher. */
export async function listMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await client()
    .from("workspace_members")
    .select("role, workspaces(id, name)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data as unknown as { role: Role; workspaces: { id: string; name: string } }[]).map((row) => ({
    id: row.workspaces.id,
    name: row.workspaces.name,
    role: row.role,
  }));
}

/**
 * Adds a new workspace under the SAME organization as the caller's
 * currently-active one (not a new organization) -- see create_workspace()'s
 * own comment for why this has to be a security-definer RPC rather than a
 * plain insert. Makes the new workspace active and returns its id so the
 * caller can navigate straight into it.
 */
export async function createWorkspace(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Workspace name can't be empty");

  const currentWsId = await getCurrentWorkspaceId();
  const { data: currentWs, error: wsErr } = await client()
    .from("workspaces")
    .select("organization_id")
    .eq("id", currentWsId)
    .single();
  if (wsErr) throw wsErr;
  const organizationId = (currentWs as { organization_id: string }).organization_id;

  const { data: newWsId, error } = await client().rpc("create_workspace", {
    p_name: trimmed,
    p_organization_id: organizationId,
  });
  if (error) throw error;

  setActiveWorkspaceId(newWsId as string);
  return newWsId as string;
}

/**
 * Owner-only, permanently destroys the workspace and everything in it (see
 * 0023_delete_workspace.sql -- the RPC itself enforces both the owner check
 * and "can't delete your only workspace"). Caller is responsible for
 * switching to a remaining workspace afterward if this was the active one.
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { error } = await client().rpc("delete_workspace", { p_workspace_id: workspaceId });
  if (error) throw error;
}

export type BillingStatus = "inactive" | "active" | "past_due" | "canceled";

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  /** Independent of role — see 0007_reimbursement_authority.sql. */
  canApproveReimbursements: boolean;
  canProcessReimbursements: boolean;
  /** True only for an admin/owner-provisioned account that hasn't set its own password yet — see 0008_admin_provisioned_accounts.sql. */
  mustChangePassword: boolean;
  /** Workspace-wide, not personal — see 0010_workspace_billing.sql. Everyone in a workspace shares its billing status. */
  billingStatus: BillingStatus;
  /** Null once the trial has ended (converted to a real subscription or never started) — see 0011_billing_trial.sql. */
  trialEndsAt: string | null;
  /** True once the 5-seat trial cap was exceeded and billing started immediately — see /api/billing/sync-seats. */
  trialEndedEarly: boolean;
  /** True once a paid subscription is scheduled to stop at currentPeriodEnd — see 0012_billing_cancellation.sql. */
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

interface MemberWithProfileRow {
  role: Role;
  job_title: string | null;
  can_approve_reimbursements: boolean;
  can_process_reimbursements: boolean;
  // Only ever selected by listUsers, not getCurrentUser — optional here
  // rather than a second near-duplicate type, same reasoning as
  // must_change_password below.
  mileage_rate_milli?: number | null;
  // Confirmed against a live query (not assumed): a many-to-one embed like
  // this comes back as a single object, e.g. {"name":"Meals"}, not an array —
  // despite the untyped client's generic .select() overload claiming the
  // opposite. Trust the runtime shape here, not the loose inferred type.
  // must_change_password is only ever selected by getCurrentUser, not
  // listUsers — optional here rather than a second near-duplicate type.
  profiles: {
    display_name: string;
    must_change_password?: boolean;
    display_currency?: string | null;
    display_distance_unit?: DistanceUnit | null;
    home_workspace_id?: string | null;
  } | null;
  workspaces: {
    billing_status: BillingStatus;
    trial_ends_at: string | null;
    trial_ended_early: boolean;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  } | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const userId = await getCurrentUserId();
  const { data, error } = await client()
    .from("workspace_members")
    .select(
      "role, job_title, can_approve_reimbursements, can_process_reimbursements, profiles(display_name, must_change_password), workspaces(billing_status, trial_ends_at, trial_ended_early, cancel_at_period_end, current_period_end)",
    )
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error) throw error;
  const row = data as unknown as MemberWithProfileRow;
  return {
    id: userId,
    name: row.profiles?.display_name ?? "",
    role: row.role,
    jobTitle: row.job_title,
    canApproveReimbursements: row.can_approve_reimbursements,
    canProcessReimbursements: row.can_process_reimbursements,
    mustChangePassword: row.profiles?.must_change_password ?? false,
    billingStatus: row.workspaces?.billing_status ?? "inactive",
    trialEndsAt: row.workspaces?.trial_ends_at ?? null,
    trialEndedEarly: row.workspaces?.trial_ended_early ?? false,
    cancelAtPeriodEnd: row.workspaces?.cancel_at_period_end ?? false,
    currentPeriodEnd: row.workspaces?.current_period_end ?? null,
  };
}

/**
 * Clears the one-time "your trial ended early" notice for the whole
 * workspace. Relies on workspaces_update's existing owner/admin-only RLS
 * policy rather than a bespoke check — same reasoning as setHomeCurrency.
 */
export async function dismissTrialEndedNotice(): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().from("workspaces").update({ trial_ended_early: false }).eq("id", wsId);
  if (error) throw error;
}

export interface WorkspaceUser {
  id: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  canApproveReimbursements: boolean;
  canProcessReimbursements: boolean;
  /**
   * Groups (see 0027_groups.sql) this person is specifically scoped to act
   * on — see 0028_reimbursement_group_authority.sql. Empty means no
   * authority over anyone yet, even if either capability above is true;
   * irrelevant for owner/admin, who have blanket authority regardless of
   * this list. Authority reaches whoever is a member of an assigned group
   * at check time, not a frozen snapshot of who was in it when assigned.
   */
  assignedGroupIds: string[];
  /** Null means "inherit the workspace's default rate" — see 0013_per_user_mileage_rate.sql. */
  mileageRateMilli: number | null;
  /** Null means "inherit the workspace default" — see 0019_personal_display_prefs.sql. Settable by an admin from Setup, or by the user themselves from Profile. */
  displayCurrency: string | null;
  displayDistanceUnit: DistanceUnit | null;
  /**
   * The one workspace this person may actually submit receipts/mileage
   * into — see 0024_home_workspace.sql. A co-member of the CURRENT
   * workspace can still have a different home (an owner administering
   * this one without claiming expenses here) -- callers that mean
   * "who can actually claim expenses here" should filter on this rather
   * than assuming every row returned by listUsers() qualifies.
   */
  homeWorkspaceId: string | null;
}

/**
 * All co-members of the caller's workspace, for the Team page.
 *
 * Prefer calling this once and building a local id -> name map over calling
 * userName() per row — the mock could afford an O(1) array lookup per row, a
 * real query cannot without an N+1 problem.
 */
export async function listUsers(): Promise<WorkspaceUser[]> {
  const wsId = await getCurrentWorkspaceId();
  const [membersRes, assignmentsRes] = await Promise.all([
    client()
      .from("workspace_members")
      .select(
        "user_id, role, job_title, can_approve_reimbursements, can_process_reimbursements, mileage_rate_milli, profiles(display_name, display_currency, display_distance_unit, home_workspace_id)",
      )
      .eq("workspace_id", wsId),
    client().from("reimbursement_group_assignments").select("approver_id, group_id").eq("workspace_id", wsId),
  ]);
  if (assignmentsRes.error) throw assignmentsRes.error;

  // Typed as unknown at the declaration site (not left to infer from
  // membersRes.data's shape) -- the fallback query below intentionally
  // selects a narrower set of columns, and both are cast through unknown
  // to MemberWithProfileRow[] below regardless.
  let membersData: unknown = membersRes.data;
  if (membersRes.error) {
    // display_currency/display_distance_unit may not exist yet on this
    // environment (0019_personal_display_prefs.sql not applied) -- fall
    // back rather than breaking Team/Setup entirely over an optional field.
    const fallback = await client()
      .from("workspace_members")
      .select("user_id, role, job_title, can_approve_reimbursements, can_process_reimbursements, mileage_rate_milli, profiles(display_name)")
      .eq("workspace_id", wsId);
    if (fallback.error) throw fallback.error;
    membersData = fallback.data;
  }
  const rows = membersData as unknown as (MemberWithProfileRow & { user_id: string })[];
  const assignments = (assignmentsRes.data ?? []) as { approver_id: string; group_id: string }[];
  return rows.map((m) => ({
    id: m.user_id,
    name: m.profiles?.display_name ?? "",
    role: m.role,
    jobTitle: m.job_title,
    canApproveReimbursements: m.can_approve_reimbursements,
    canProcessReimbursements: m.can_process_reimbursements,
    mileageRateMilli: m.mileage_rate_milli ?? null,
    displayCurrency: m.profiles?.display_currency ?? null,
    displayDistanceUnit: m.profiles?.display_distance_unit ?? null,
    homeWorkspaceId: m.profiles?.home_workspace_id ?? null,
    assignedGroupIds: assignments.filter((a) => a.approver_id === m.user_id).map((a) => a.group_id),
  }));
}

/**
 * Replaces the full set of groups an approver/refunder is scoped to in one
 * call, rather than granular add/remove — simpler UX (a checklist of every
 * group, saved as a whole) and simpler to reason about than incremental
 * inserts/deletes racing each other.
 */
export async function setReimbursementGroupAssignments(approverUserId: string, groupIds: string[]): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { error: delErr } = await client()
    .from("reimbursement_group_assignments")
    .delete()
    .eq("workspace_id", wsId)
    .eq("approver_id", approverUserId);
  if (delErr) throw delErr;
  if (groupIds.length === 0) return;
  const { error: insErr } = await client()
    .from("reimbursement_group_assignments")
    .insert(groupIds.map((groupId) => ({ workspace_id: wsId, approver_id: approverUserId, group_id: groupId })));
  if (insErr) throw insErr;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

/**
 * Plain organizational groups (e.g. "Sales team") -- see 0027_groups.sql.
 * No authority semantics of their own, unlike the Admin/Finance/Approver
 * security groups; purely for grouping people. Fetches group_members
 * separately and folds it in client-side rather than a nested embed, since
 * a group with zero members would otherwise vanish from an inner join.
 */
export async function listGroups(): Promise<Group[]> {
  const wsId = await getCurrentWorkspaceId();
  const [groupsRes, membersRes] = await Promise.all([
    client().from("groups").select("id, name").eq("workspace_id", wsId).order("name"),
    client().from("group_members").select("group_id, user_id"),
  ]);
  if (groupsRes.error) throw groupsRes.error;
  if (membersRes.error) throw membersRes.error;

  const memberRows = membersRes.data as unknown as { group_id: string; user_id: string }[];
  return (groupsRes.data as unknown as { id: string; name: string }[]).map((g) => ({
    id: g.id,
    name: g.name,
    memberIds: memberRows.filter((m) => m.group_id === g.id).map((m) => m.user_id),
  }));
}

export async function createGroup(name: string): Promise<string> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client().from("groups").insert({ workspace_id: wsId, name }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await client().from("groups").update({ name }).eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await client().from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

/** Same "replace the whole set" shape as setReimbursementGroupAssignments -- see there for why. */
export async function setGroupMembers(groupId: string, userIds: string[]): Promise<void> {
  const { error: delErr } = await client().from("group_members").delete().eq("group_id", groupId);
  if (delErr) throw delErr;
  if (userIds.length === 0) return;
  const { error: insErr } = await client()
    .from("group_members")
    .insert(userIds.map((userId) => ({ group_id: groupId, user_id: userId })));
  if (insErr) throw insErr;
}

/**
 * Removes someone from the caller's workspace — revokes access immediately
 * (RLS gates everything on workspace membership), but deliberately does NOT
 * touch their receipts/mileage trips or their account itself: those stay on
 * record, attributed to them, for audit continuity. Re-provisioning or
 * re-inviting the same email later restores access, not history.
 *
 * workspace_members' own RLS write policy (owner/admin-only) already covers
 * this delete — no service role needed. Also clears any reimbursement
 * group assignments naming them as the approver, so nothing stale lingers
 * once they're gone (their membership in any group, and any authority that
 * grants OTHER approvers over them, follows removal automatically -- there's
 * no separate "employee side" to clean up anymore, unlike the old
 * per-employee assignments).
 */
export async function removeMember(userId: string): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { error: approverErr } = await client()
    .from("reimbursement_group_assignments")
    .delete()
    .eq("workspace_id", wsId)
    .eq("approver_id", userId);
  if (approverErr) throw approverErr;
  const { error } = await client().from("workspace_members").delete().eq("workspace_id", wsId).eq("user_id", userId);
  if (error) throw error;
}

/**
 * Grants/revokes another member's reimbursement authority. Goes through the
 * grant_reimbursement_authority() RPC rather than updating workspace_members
 * directly — that table's RLS write policy is owner/admin-only for good
 * reason (it also covers role and job_title), so a super user (a plain
 * member with both capabilities) needs a narrower, SECURITY DEFINER path
 * that only ever touches these two columns. See 0007_reimbursement_authority.sql.
 */
export async function setReimbursementAuthority(
  userId: string,
  canApprove: boolean,
  canProcess: boolean,
): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().rpc("grant_reimbursement_authority", {
    p_workspace_id: wsId,
    p_user_id: userId,
    p_can_approve: canApprove,
    p_can_process: canProcess,
  });
  if (error) throw error;
}

export type SecurityGroup = "admin" | "finance" | "approve" | "member";

/**
 * Unifies role (owner/admin/member) and reimbursement authority into the
 * four tiers shown on Setup's security-group table: Admin (full platform
 * access), Finance (refund), Approver (approve/reject), Member (none).
 * Promoting to/demoting from "admin" writes role directly -- relies on
 * workspace_members' owner/admin-only members_write RLS policy, same as
 * setUserMileageRate, so only an existing admin/owner can grant or revoke
 * admin access. The other three tiers only ever touch the reimbursement
 * booleans via setReimbursementAuthority, which a non-admin super user can
 * also do -- demoting an actual admin still requires admin/owner, since
 * that step needs the role write above.
 */
export async function setMemberSecurityGroup(userId: string, currentRole: Role, group: SecurityGroup): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  if (group === "admin") {
    // Also grants both reimbursement-authority booleans -- acting on one's
    // OWN claim never gets the role-based blanket-authority bypass (see
    // enforce_reimbursement_authority() in 0009_reimbursement_assignments.sql),
    // so without these an admin's own Approve/Refund buttons would render
    // enabled (canTransitionReimbursement assumes every admin has both) yet
    // fail with a raw 403 the moment they click one for their own expense.
    const { error } = await client()
      .from("workspace_members")
      .update({ role: "admin", can_approve_reimbursements: true, can_process_reimbursements: true })
      .eq("workspace_id", wsId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  if (currentRole === "admin") {
    const { error } = await client().from("workspace_members").update({ role: "member" }).eq("workspace_id", wsId).eq("user_id", userId);
    if (error) throw error;
  }
  await setReimbursementAuthority(userId, group === "approve", group === "finance");
}

/**
 * Promotes a co-member to a second (or further) System Admin (owner) --
 * see 0031_second_system_admin.sql. Owner-only to grant, enforced by the
 * RPC itself (a plain admin minting a peer with authority over them would
 * defeat the "only an owner can create another owner" chain of trust) --
 * this is a thin wrapper, all the real logic lives in the database.
 */
export async function promoteToOwner(userId: string): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().rpc("promote_to_owner", { p_workspace_id: wsId, p_user_id: userId });
  if (error) throw error;
}

/**
 * Whether the caller is on the short, hand-maintained platform-support
 * allowlist -- see 0032_platform_support.sql. Safe to expose directly:
 * this only ever reveals the caller's own status, never anyone else's.
 * Gates apps/web's hidden /platform-admin recovery page.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await client().rpc("is_platform_admin");
  if (error) throw error;
  return data as boolean;
}

export interface PlatformWorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

/** Platform-admin-only: looks up an arbitrary workspace's members to pick a recovery target from. */
export async function platformListWorkspaceMembers(workspaceId: string): Promise<PlatformWorkspaceMember[]> {
  const { data, error } = await client().rpc("platform_list_workspace_members", { p_workspace_id: workspaceId });
  if (error) throw error;
  return (data as { user_id: string; display_name: string; email: string; role: Role }[]).map((row) => ({
    userId: row.user_id,
    name: row.display_name,
    email: row.email,
    role: row.role,
  }));
}

/**
 * Platform-admin-only: promotes an existing member of the target workspace
 * to System Admin -- the recovery path for when every System Admin there
 * is unreachable. Every use is permanently logged server-side (see
 * platform_recovery_events).
 */
export async function platformPromoteToOwner(workspaceId: string, userId: string): Promise<void> {
  const { error } = await client().rpc("platform_promote_to_owner", { p_workspace_id: workspaceId, p_target_user_id: userId });
  if (error) throw error;
}

/**
 * Owner/admin-only, enforced by workspace_members' existing members_write
 * RLS policy (no RPC/super-user carve-out needed here, unlike
 * setReimbursementAuthority — a mileage rate is a payroll decision, not
 * something a granted-authority member should set for themselves or
 * others). Pass null to fall back to the workspace's own default rate.
 */
export async function setUserMileageRate(userId: string, rateMilli: number | null): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client()
    .from("workspace_members")
    .update({ mileage_rate_milli: rateMilli })
    .eq("workspace_id", wsId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Admin setting a CO-MEMBER's personal display currency/unit -- the only
 * way these get set (no self-service; see the Setup page's "User currency
 * & mileage" table). Goes through the set_user_display_currency/
 * set_user_display_distance_unit security-definer RPCs (see
 * 0020_admin_set_display_prefs.sql) rather than a broadened profiles RLS
 * policy, since profiles has no admin-write policy and broadening it would
 * let an admin write ANY column on a co-member's profile, not just this one
 * preference.
 */
export async function setUserDisplayCurrency(userId: string, code: string | null): Promise<void> {
  if (code !== null && !SUPPORTED_CURRENCIES.includes(code)) return;
  const { error } = await client().rpc("set_user_display_currency", { target_user_id: userId, new_currency: code });
  if (error) throw error;
}

export async function setUserDisplayDistanceUnit(userId: string, unit: DistanceUnit | null): Promise<void> {
  const { error } = await client().rpc("set_user_display_distance_unit", { target_user_id: userId, new_unit: unit });
  if (error) throw error;
}

export async function userName(id: string): Promise<string> {
  const { data, error } = await client().from("profiles").select("display_name").eq("id", id).single();
  if (error) throw error;
  return (data as { display_name: string }).display_name ?? "Unknown";
}

// ── invites ──────────────────────────────────────────────────────────────
//
// Every signup gets its own solo workspace (0001_init.sql's handle_new_user).
// Inviting someone in means migrating them off whatever workspace they're
// currently in onto the inviter's — see 0004_workspace_invites.sql's
// accept_workspace_invite(), which does the actual data move.

interface InviteRow {
  id: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
}

/** Pending invites for the caller's own workspace — admin-only, enforced by RLS. */
export async function listWorkspaceInvites(): Promise<WorkspaceInvite[]> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client()
    .from("workspace_invites")
    .select("id, email, role, status, created_at")
    .eq("workspace_id", wsId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as InviteRow[]).map((r) => ({ id: r.id, email: r.email, role: r.role, status: r.status, createdAt: r.created_at }));
}

export async function inviteTeammate(email: string, role: Role): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const userId = await getCurrentUserId();
  const { error } = await client()
    .from("workspace_invites")
    .insert({ workspace_id: wsId, email: email.trim().toLowerCase(), role, invited_by: userId });
  if (error) throw error;
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await client().from("workspace_invites").update({ status: "revoked" }).eq("id", id);
  if (error) throw error;
}

/**
 * The signed-in user's own pending invite, if any — checked wherever the app
 * gates on session (see apps/*\/lib/queries.ts).
 *
 * Two different workspaces can each invite the same email independently
 * (the unique constraint is per-workspace, not global), so more than one row
 * can legitimately match here. .maybeSingle() would throw in that case —
 * order + limit(1) picks the most recently sent invite instead. The other
 * invite(s) stay pending but unreachable from this UI until the shown one is
 * accepted or revoked; a real multi-invite picker is more than this edge
 * case has needed so far.
 */
export async function getMyPendingInvite(): Promise<MyPendingInvite | null> {
  const session = await getSession();
  const email = session?.user.email;
  if (!email) return null;
  const { data, error } = await client()
    .from("workspace_invites")
    .select("id, email, role, status, created_at, workspaces(name)")
    .eq("status", "pending")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data as unknown as (InviteRow & { workspaces: { name: string } | null })[])[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    workspaceName: row.workspaces?.name ?? "the workspace",
  };
}

/**
 * Accepts an invite: migrates the caller's own membership, receipts, and
 * mileage trips onto the invite's workspace (see accept_workspace_invite()
 * in 0004_workspace_invites.sql for exactly what moves). No Storage step is
 * needed here — receipt photo visibility follows the receipt's current
 * workspace_id, not the object's folder prefix, via the
 * receipts_bucket_select_via_receipt policy in that same migration.
 */
export async function acceptInvite(inviteId: string): Promise<void> {
  const { error } = await client().rpc("accept_workspace_invite", { p_invite_id: inviteId });
  if (error) throw error;
}

// ── workspace settings ───────────────────────────────────────────────────

interface WorkspaceRow {
  id: string;
  name: string;
  home_currency: string;
  mileage_unit: DistanceUnit;
  mileage_rate_milli: number;
}

async function getWorkspaceRow(): Promise<WorkspaceRow> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client()
    .from("workspaces")
    .select("id, name, home_currency, mileage_unit, mileage_rate_milli")
    .eq("id", wsId)
    .single();
  if (error) throw error;
  return data as WorkspaceRow;
}

export async function getWorkspaceName(): Promise<string> {
  return (await getWorkspaceRow()).name;
}

/**
 * Distinct PEOPLE across every workspace in the current workspace's
 * organization, not memberships -- see 0021_consolidated_seat_count.sql.
 * For display on the Invoice & Payment page; billing itself is still
 * charged per-workspace today.
 */
export async function getConsolidatedSeatCount(): Promise<number> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client().rpc("get_consolidated_seat_count", { p_workspace_id: wsId });
  if (error) throw error;
  return data as number;
}

/**
 * Customer billing address for invoices -- see 0022_billing_address.sql.
 * Editing (which also syncs to the Stripe Customer object) happens via
 * apps/web's /api/billing/update-address route, not here, since that sync
 * needs the Stripe secret key held server-side.
 */
export interface BillingAddress {
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxId: string | null;
  billingEmail: string | null;
}

export async function getBillingAddress(): Promise<BillingAddress> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client()
    .from("workspaces")
    .select(
      "billing_legal_name, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, billing_tax_id, billing_email",
    )
    .eq("id", wsId)
    .single();
  if (error) throw error;
  const row = data as {
    billing_legal_name: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_postal_code: string | null;
    billing_country: string | null;
    billing_tax_id: string | null;
    billing_email: string | null;
  };
  return {
    legalName: row.billing_legal_name,
    addressLine1: row.billing_address_line1,
    addressLine2: row.billing_address_line2,
    city: row.billing_city,
    state: row.billing_state,
    postalCode: row.billing_postal_code,
    country: row.billing_country,
    taxId: row.billing_tax_id,
    billingEmail: row.billing_email,
  };
}

export async function setWorkspaceName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().from("workspaces").update({ name: trimmed }).eq("id", wsId);
  if (error) throw error;
}

/** Plain ISO codes — real receipts store their amount already converted at write time, so no FX table is needed here (contrast mock-api's FX_FROM_EUR). */
export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "MXN", "INR", "BRL", "SEK"];

export async function getHomeCurrency(): Promise<string> {
  return (await getWorkspaceRow()).home_currency;
}

export async function setHomeCurrency(code: string): Promise<void> {
  if (!SUPPORTED_CURRENCIES.includes(code)) return;
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().from("workspaces").update({ home_currency: code }).eq("id", wsId);
  if (error) throw error;
}

/**
 * Personal, display-only overrides -- null means "use the workspace
 * default" (see 0019_personal_display_prefs.sql). These never change what's
 * stored or reimbursed, only how amounts/distances render for the one
 * person who has them set. Set only by an admin, from the web app's Setup
 * page (see setUserDisplayCurrency/setUserDisplayDistanceUnit below) --
 * mobile and the caller's own web views just read the effective value
 * (their own app's lib/data.ts combines this with
 * getHomeCurrency()/getDistanceUnit()); the web Profile page shows it
 * read-only.
 *
 * Fails open to "no override" rather than throwing -- getDashboard(),
 * listReceipts(), listMileage() etc. all call this on the way to returning
 * their own result, so a hiccup here (the migration not applied yet on a
 * given environment, a transient network error) must never take down the
 * core app over what is ultimately a nicety.
 */
export async function getMyDisplayPrefs(): Promise<{ currency: string | null; distanceUnit: DistanceUnit | null }> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await client()
      .from("profiles")
      .select("display_currency, display_distance_unit")
      .eq("id", userId)
      .single();
    if (error) throw error;
    const row = data as { display_currency: string | null; display_distance_unit: DistanceUnit | null };
    return { currency: row.display_currency, distanceUnit: row.display_distance_unit };
  } catch {
    return { currency: null, distanceUnit: null };
  }
}

/** Opt-in — a daily digest email listing each approver's own pending decisions. See 0016_daily_approval_reminders.sql. */
export async function getDailyApprovalRemindersEnabled(): Promise<boolean> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client().from("workspaces").select("daily_approval_reminders_enabled").eq("id", wsId).single();
  if (error) throw error;
  return (data as { daily_approval_reminders_enabled: boolean }).daily_approval_reminders_enabled;
}

export async function setDailyApprovalRemindersEnabled(enabled: boolean): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().from("workspaces").update({ daily_approval_reminders_enabled: enabled }).eq("id", wsId);
  if (error) throw error;
}

export async function getDistanceUnit(): Promise<DistanceUnit> {
  return (await getWorkspaceRow()).mileage_unit;
}

/**
 * Converts the rate once when the unit changes, so the reimbursement stays
 * worth roughly the same rather than silently becoming 1.6x wrong — same
 * reasoning as mock-api's setDistanceUnit.
 */
export async function setDistanceUnit(unit: DistanceUnit): Promise<void> {
  const row = await getWorkspaceRow();
  if (row.mileage_unit === unit) return;
  const newRate = Math.round(unit === "km" ? row.mileage_rate_milli / MI_TO_KM : row.mileage_rate_milli * MI_TO_KM);
  const { error } = await client()
    .from("workspaces")
    .update({ mileage_unit: unit, mileage_rate_milli: newRate })
    .eq("id", row.id);
  if (error) throw error;
}

export async function getMileageRateMilli(): Promise<number> {
  return (await getWorkspaceRow()).mileage_rate_milli;
}

export async function setMileageRateMilli(value: number): Promise<void> {
  if (!Number.isFinite(value) || value <= 0) return;
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().from("workspaces").update({ mileage_rate_milli: Math.round(value) }).eq("id", wsId);
  if (error) throw error;
}

/**
 * The rate the CALLER's own trips actually use — their own
 * workspace_members.mileage_rate_milli override if an owner/admin set one,
 * else the workspace's default. See 0013_per_user_mileage_rate.sql.
 */
async function getEffectiveMileageRateMilli(ws: WorkspaceRow): Promise<number> {
  const userId = await getCurrentUserId();
  const { data, error } = await client()
    .from("workspace_members")
    .select("mileage_rate_milli")
    .eq("workspace_id", ws.id)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return (data as { mileage_rate_milli: number | null }).mileage_rate_milli ?? ws.mileage_rate_milli;
}

export async function getMyMileageRateMilli(): Promise<number> {
  return getEffectiveMileageRateMilli(await getWorkspaceRow());
}

/** What a trip WOULD be worth if saved now — same rate the save itself will use. */
export async function estimateMileageAmountMinor(distance: number, unit: DistanceUnit): Promise<number> {
  const row = await getWorkspaceRow();
  const rateMilli = await getEffectiveMileageRateMilli(row);
  return mileageAmountForTrip(distance, unit, rateMilli, row.mileage_unit, row.home_currency);
}

// ── categories ───────────────────────────────────────────────────────────

export async function listCategories(): Promise<string[]> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client()
    .from("categories")
    .select("name")
    .eq("workspace_id", wsId)
    .is("archived_at", null)
    .order("sort_order");
  if (error) throw error;
  return (data as { name: string }[]).map((c) => c.name);
}

async function resolveCategoryId(workspaceId: string, name: string): Promise<string> {
  const { data: existing } = await client()
    .from("categories")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", name)
    .is("archived_at", null)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data: created, error } = await client()
    .from("categories")
    .insert({ workspace_id: workspaceId, name })
    .select("id")
    .single();
  if (error) throw error;
  return (created as { id: string }).id;
}

export async function addCategoryName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const wsId = await getCurrentWorkspaceId();
  await resolveCategoryId(wsId, trimmed);
}

/**
 * Soft delete — see 0001_init.sql's comment on categories.archived_at:
 * "Removing a category reassigns receipts to 'Other'; archiving keeps
 * history intact and makes the action reversible."
 */
export async function removeCategoryName(name: string): Promise<void> {
  const wsId = await getCurrentWorkspaceId();
  const { data: cat, error: fetchErr } = await client()
    .from("categories")
    .select("id")
    .eq("workspace_id", wsId)
    .eq("name", name)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!cat) return;
  const catId = (cat as { id: string }).id;
  const otherId = await resolveCategoryId(wsId, "Other");
  const { error: reassignErr } = await client().from("receipts").update({ category_id: otherId }).eq("category_id", catId);
  if (reassignErr) throw reassignErr;
  const { error: archiveErr } = await client()
    .from("categories")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", catId);
  if (archiveErr) throw archiveErr;
}

// ── receipt photos (Supabase Storage) ───────────────────────────────────
//
// The "receipts" bucket is private (created via the Storage API, not SQL —
// see 0003_receipt_photos_storage.sql for its RLS). receipts.image_path
// stores the STORAGE PATH ("{workspaceId}/{filename}"), never a directly
// usable URL — callers must exchange it for a signed URL to actually
// display the image, and that URL expires.

/**
 * Uploads a captured photo and returns the storage path to store on the
 * receipt — not a URL. No crypto.randomUUID() here: it's not universally
 * available across the environments this package runs in (browser vs
 * Hermes), so a plain timestamp+random string stands in for a unique name.
 *
 * Accepts raw bytes as well as Blob: fetch(localUri).blob() silently
 * produces a 0-byte blob for a local file:// URI under Hermes (works fine
 * in a browser, not in React Native) — the mobile caller reads the file
 * directly via expo-file-system's File.bytes() instead.
 */
export async function uploadReceiptPhoto(photo: Blob | Uint8Array, contentType: string): Promise<string> {
  const wsId = await getCurrentWorkspaceId();
  const ext = contentType === "image/png" ? "png" : "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${wsId}/${filename}`;
  const { error } = await client().storage.from("receipts").upload(path, photo, { contentType });
  if (error) throw error;
  return path;
}

/** A short-lived URL for displaying a photo given its stored path. Null if the path is missing or the exchange fails. */
export async function getReceiptPhotoUrl(imagePath: string | null): Promise<string | null> {
  if (!imagePath) return null;
  const { data, error } = await client().storage.from("receipts").createSignedUrl(imagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ── receipts ─────────────────────────────────────────────────────────────

const RECEIPT_SELECT =
  "*, categories(name), receipt_line_items(id, description, quantity, unit_price_minor, amount_minor, sort_order)";

interface ReceiptRow {
  id: string;
  workspace_id: string;
  created_by: string;
  status: Receipt["status"];
  image_path: string | null;
  vendor: string | null;
  receipt_date: string | null;
  category_id: string | null;
  // A single object, not an array — see MemberWithProfileRow's comment;
  // confirmed against a live query, not assumed from the inferred type.
  categories: { name: string } | null;
  currency: string;
  subtotal_minor: number | null;
  tax_minor: number | null;
  total_minor: number;
  reclaim_minor: number | null;
  original_currency: string | null;
  original_total_minor: number | null;
  fx_rate: number | null;
  fx_rate_date: string | null;
  country: string | null;
  payment_brand: string | null;
  payment_last4: string | null;
  payment_type: Receipt["paymentType"];
  comment: string | null;
  reimbursement_status: ReimbursementStatus;
  rejection_reason: string | null;
  extraction_confidence: number | null;
  receipt_line_items: { id: string; description: string; quantity: number; unit_price_minor: number; amount_minor: number }[];
  created_at: string;
}

function mapReceiptRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    status: row.status,
    imagePath: row.image_path,
    vendor: row.vendor,
    receiptDate: row.receipt_date,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
    currency: row.currency,
    subtotalMinor: row.subtotal_minor,
    taxMinor: row.tax_minor,
    totalMinor: row.total_minor,
    reclaimMinor: row.reclaim_minor,
    originalCurrency: row.original_currency,
    originalTotalMinor: row.original_total_minor,
    fxRate: row.fx_rate,
    fxRateDate: row.fx_rate_date,
    country: row.country,
    paymentBrand: row.payment_brand,
    paymentLast4: row.payment_last4,
    paymentType: row.payment_type,
    comment: row.comment,
    reimbursementStatus: row.reimbursement_status,
    rejectionReason: row.rejection_reason,
    extractionConfidence: row.extraction_confidence,
    lineItems: (row.receipt_line_items ?? []).map((li) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      unitPriceMinor: li.unit_price_minor,
      amountMinor: li.amount_minor,
    })),
    createdAt: row.created_at,
  };
}

/** [start, endExclusive) as ISO dates for a "YYYY-MM" month. */
function monthRange(yyyyMm: string): [string, string] {
  const [year, month] = yyyyMm.split("-").map(Number) as [number, number];
  const start = `${yyyyMm}-01`;
  const endDate = new Date(year, month, 1); // first day of the following month
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
  return [start, end];
}

export async function listReceipts(
  opts: { month?: string; categoryName?: string; userId?: string; q?: string } = {},
): Promise<Receipt[]> {
  const wsId = await getCurrentWorkspaceId();
  let query = client().from("receipts").select(RECEIPT_SELECT).eq("workspace_id", wsId).order("receipt_date", { ascending: false });
  if (opts.month) {
    const [start, end] = monthRange(opts.month);
    query = query.gte("receipt_date", start).lt("receipt_date", end);
  }
  if (opts.userId && opts.userId !== "All") query = query.eq("created_by", opts.userId);
  if (opts.q) query = query.ilike("vendor", `%${opts.q}%`);
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data as ReceiptRow[]).map(mapReceiptRow);
  // Filtered client-side rather than via a Postgrest embedded-resource filter:
  // categoryName only exists after the categories join, and the row count per
  // workspace here is small enough that this isn't worth the query complexity.
  if (opts.categoryName && opts.categoryName !== "All") {
    rows = rows.filter((r) => r.categoryName === opts.categoryName);
  }
  return rows;
}

export async function getReceipt(id: string): Promise<Receipt | undefined> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client().from("receipts").select(RECEIPT_SELECT).eq("id", id).eq("workspace_id", wsId).maybeSingle();
  if (error) throw error;
  return data ? mapReceiptRow(data as ReceiptRow) : undefined;
}

/**
 * Same vendor, date, and total already on record — a soft warning against
 * an accidental double-submission (e.g. scanning the same photo twice), not
 * a hard block. Scoped to the active workspace (not just whatever RLS lets
 * the caller see overall) — otherwise a coincidental match in a *different*
 * workspace the same person belongs to would trigger a false "duplicate".
 */
export async function findDuplicateReceipt(vendor: string, receiptDate: string | null, totalMinor: number): Promise<boolean> {
  const trimmed = vendor.trim();
  if (!trimmed || totalMinor <= 0) return false;
  const wsId = await getCurrentWorkspaceId();
  let query = client()
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", wsId)
    .ilike("vendor", trimmed)
    .eq("total_minor", totalMinor);
  query = receiptDate ? query.eq("receipt_date", receiptDate) : query.is("receipt_date", null);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function addReceipt(input: {
  vendor: string;
  receiptDate: string | null;
  totalMinor: number;
  taxMinor: number;
  categoryName: string;
  comment: string;
  paymentBrand: string | null;
  paymentLast4: string | null;
  imagePath: string | null;
  /** Populated only when the receipt was printed in a different currency — see @rr/shared's Receipt type. */
  originalCurrency?: string | null;
  originalTotalMinor?: number | null;
  fxRate?: number | null;
  fxRateDate?: string | null;
  /** ISO 3166-1 alpha-2, detected from the receipt itself — see @rr/shared's Receipt type. */
  country?: string | null;
}): Promise<Receipt> {
  const userId = await getCurrentUserId();
  const wsId = await getCurrentWorkspaceId();
  const [categoryId, ws] = await Promise.all([resolveCategoryId(wsId, input.categoryName), getWorkspaceRow()]);
  const { data, error } = await client()
    .from("receipts")
    .insert({
      workspace_id: wsId,
      created_by: userId,
      status: "processed",
      image_path: input.imagePath,
      vendor: input.vendor || null,
      receipt_date: input.receiptDate,
      category_id: categoryId,
      // Explicit, rather than relying on the column's 'EUR' default — every
      // receipt is stored in the workspace's actual home currency, whatever
      // that is.
      currency: ws.home_currency,
      // total_minor is a generated column (subtotal + tax) — never written directly.
      subtotal_minor: input.totalMinor - input.taxMinor,
      tax_minor: input.taxMinor,
      payment_brand: input.paymentBrand,
      payment_last4: input.paymentLast4,
      comment: input.comment || null,
      reimbursement_status: "pending",
      original_currency: input.originalCurrency ?? null,
      original_total_minor: input.originalTotalMinor ?? null,
      fx_rate: input.fxRate ?? null,
      fx_rate_date: input.fxRateDate ?? null,
      fx_source: input.originalCurrency ? "ECB" : null,
      country: input.country ?? null,
    })
    .select(RECEIPT_SELECT)
    .single();
  if (error) throw error;
  return mapReceiptRow(data as ReceiptRow);
}

/**
 * Only permitted while pending or rejected — see canDeleteReceipt.  RLS's
 * receipts_delete policy allows the delete for created_by/admin regardless
 * of status — it does not itself enforce this rule — so it is checked here,
 * same UI-affordance-only caveat as @rr/shared/authz.ts: this is not a
 * substitute for a DB-level guarantee, just what's available without
 * altering the already-applied migration.
 */
export async function deleteReceipt(id: string): Promise<boolean> {
  const { data: receipt, error: fetchErr } = await client()
    .from("receipts")
    .select("reimbursement_status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !receipt) return false;
  if (!canDeleteReceipt((receipt as { reimbursement_status: ReimbursementStatus }).reimbursement_status)) return false;
  const { error } = await client().from("receipts").delete().eq("id", id);
  return !error;
}

export async function setCategory(id: string, categoryName: string): Promise<void> {
  const { data: receipt, error: fetchErr } = await client().from("receipts").select("workspace_id").eq("id", id).single();
  if (fetchErr) throw fetchErr;
  const categoryId = await resolveCategoryId((receipt as { workspace_id: string }).workspace_id, categoryName);
  const { error } = await client().from("receipts").update({ category_id: categoryId }).eq("id", id);
  if (error) throw error;
}

export async function setComment(id: string, comment: string): Promise<void> {
  const { error } = await client().from("receipts").update({ comment: comment || null }).eq("id", id);
  if (error) throw error;
}

/** Stored directly in the receipt's own currency — no conversion, unlike mock-api's fromHome(). */
export async function setReclaimMinor(id: string, minor: number): Promise<void> {
  const { error } = await client().from("receipts").update({ reclaim_minor: minor }).eq("id", id);
  if (error) throw error;
}

/**
 * The enforce_reimbursement_authority trigger does the actual work: checks the
 * caller holds the capability the target status needs (canApproveReimbursements
 * for approve/reject/back-to-pending, canProcessReimbursements for the final
 * payout), enforces the self-approval rule, requires a reason on rejection,
 * and logs to reimbursement_events — all server-side, so every client that
 * writes here is covered the same way. This just makes the write; a rejected
 * trigger surfaces as a thrown Postgrest error.
 */
export async function setReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): Promise<void> {
  const { error } = await client()
    .from("receipts")
    .update({ reimbursement_status: status, rejection_reason: status === "rejected" ? reason ?? null : null })
    .eq("id", id);
  if (error) throw error;
}

/** Same enforce_reimbursement_authority trigger as receipts (trg_mileage_reimbursement_authority, already applied in 0001_init.sql) — this was just missing the client-side mutator. */
export async function setMileageReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): Promise<void> {
  const { error } = await client()
    .from("mileage_trips")
    .update({ reimbursement_status: status, rejection_reason: status === "rejected" ? reason ?? null : null })
    .eq("id", id);
  if (error) throw error;
}

// ── mileage ──────────────────────────────────────────────────────────────

interface TripRow {
  id: string;
  workspace_id: string;
  user_id: string;
  trip_date: string;
  purpose: string;
  distance: number;
  distance_unit: DistanceUnit;
  rate_milli: number;
  rate_unit: DistanceUnit;
  amount_minor: number;
  reimbursement_status: ReimbursementStatus;
  rejection_reason: string | null;
  start_address: string | null;
  end_address: string | null;
}

function mapTripRow(row: TripRow): MileageTrip {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    tripDate: row.trip_date,
    purpose: row.purpose,
    distance: row.distance,
    distanceUnit: row.distance_unit,
    rateMilli: row.rate_milli,
    rateUnit: row.rate_unit,
    amountMinor: row.amount_minor,
    reimbursementStatus: row.reimbursement_status,
    rejectionReason: row.rejection_reason,
    startAddress: row.start_address,
    endAddress: row.end_address,
  };
}

export async function listMileage(userId?: string): Promise<MileageTrip[]> {
  const wsId = await getCurrentWorkspaceId();
  let query = client().from("mileage_trips").select("*").eq("workspace_id", wsId).order("trip_date", { ascending: false });
  if (userId && userId !== "All") query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as TripRow[]).map(mapTripRow);
}

export async function addMileageTrip(input: {
  tripDate: string;
  purpose: string;
  distance: number;
  distanceUnit: DistanceUnit;
  /** Populated only for a trip entered via automatic (address-based) distance calculation. */
  startAddress?: string | null;
  endAddress?: string | null;
}): Promise<MileageTrip> {
  const userId = await getCurrentUserId();
  const wsId = await getCurrentWorkspaceId();
  const ws = await getWorkspaceRow();
  // The caller's own effective rate (their per-user override if an
  // owner/admin set one, else the workspace default) — frozen onto this
  // trip at entry, same reasoning as fx_rate on receipts: existing trips
  // keep their own rate even if the workspace default or their override
  // changes later.
  const rateMilli = await getEffectiveMileageRateMilli(ws);
  // The rate is expressed per the workspace's CURRENT mileage_unit (see
  // Settings' "Reimbursement rate per {unit}" label) — frozen alongside the
  // rate itself, so a later unit change can't silently misinterpret this
  // trip's already-locked-in rate. See 0014_mileage_rate_unit.sql.
  const amountMinor = mileageAmountForTrip(input.distance, input.distanceUnit, rateMilli, ws.mileage_unit, ws.home_currency);
  const { data, error } = await client()
    .from("mileage_trips")
    .insert({
      workspace_id: wsId,
      user_id: userId,
      trip_date: input.tripDate,
      purpose: input.purpose,
      distance: input.distance,
      distance_unit: input.distanceUnit,
      rate_unit: ws.mileage_unit,
      rate_milli: rateMilli,
      amount_minor: amountMinor,
      reimbursement_status: "pending",
      start_address: input.startAddress ?? null,
      end_address: input.endAddress ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapTripRow(data as TripRow);
}

/**
 * Edit a pending trip. Frozen once approved, paid, or rejected — enforced by
 * the enforce_mileage_amount_frozen trigger for the amount-affecting fields;
 * the pending check here also gates tripDate/purpose, which the trigger does
 * not touch, so it stays a client-side check for those two fields specifically.
 *
 * The amount is recomputed from the trip's OWN frozen rate, not the current
 * workspace rate — correcting a distance must not silently reprice a trip at
 * today's rate if the workspace rate has changed since it was logged.
 */
export async function updateMileageTrip(
  id: string,
  patch: { tripDate?: string; purpose?: string; distance?: number },
): Promise<MileageTrip | null> {
  const { data: existing, error: fetchErr } = await client().from("mileage_trips").select("*").eq("id", id).single();
  if (fetchErr || !existing) return null;
  const row = existing as TripRow;
  if (row.reimbursement_status !== "pending") return null;

  const update: Record<string, unknown> = {};
  if (patch.tripDate !== undefined) update.trip_date = patch.tripDate;
  if (patch.purpose !== undefined) update.purpose = patch.purpose;
  if (patch.distance !== undefined && patch.distance > 0) {
    const ws = await getWorkspaceRow();
    update.distance = patch.distance;
    update.amount_minor = mileageAmountForTrip(patch.distance, row.distance_unit, row.rate_milli, row.rate_unit, ws.home_currency);
  }

  const { data, error } = await client().from("mileage_trips").update(update).eq("id", id).select("*").single();
  if (error) return null;
  return mapTripRow(data as TripRow);
}

/** Same reasoning/caveat as deleteReceipt. */
export async function deleteMileageTrip(id: string): Promise<boolean> {
  const { data: trip, error: fetchErr } = await client()
    .from("mileage_trips")
    .select("reimbursement_status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !trip) return false;
  if ((trip as { reimbursement_status: ReimbursementStatus }).reimbursement_status !== "pending") return false;
  const { error } = await client().from("mileage_trips").delete().eq("id", id);
  return !error;
}

// ── derived: dashboard, team, owed-to-user ───────────────────────────────

/**
 * `userId` narrows to one person's own rows regardless of what RLS itself
 * would additionally allow — an owner/admin's RLS grant covers the whole
 * workspace, but a caller (mobile's personal dashboard) can still ask for
 * just their own by passing their own id.
 */
async function fetchAllReceipts(userId?: string): Promise<Receipt[]> {
  const wsId = await getCurrentWorkspaceId();
  let query = client().from("receipts").select(RECEIPT_SELECT).eq("workspace_id", wsId);
  if (userId) query = query.eq("created_by", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ReceiptRow[]).map(mapReceiptRow);
}

async function fetchAllTrips(userId?: string): Promise<MileageTrip[]> {
  const wsId = await getCurrentWorkspaceId();
  let query = client().from("mileage_trips").select("*").eq("workspace_id", wsId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as TripRow[]).map(mapTripRow);
}

/**
 * `userId`: omit for the workspace-wide view (Team page only — that's where
 * approving/reviewing everyone's claims happens). Pass the caller's own id
 * for a personal-only view — both the web Dashboard and mobile always do
 * this, so "how am I doing" stays personal even for an owner/admin.
 */
export async function getDashboard(month?: string, userId?: string): Promise<DashboardResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const targetMonth = month ?? today.slice(0, 7);

  const [ws, allReceipts, allTrips] = await Promise.all([
    getWorkspaceRow(),
    fetchAllReceipts(userId),
    fetchAllTrips(userId),
  ]);

  const monthReceipts = allReceipts.filter((r) => inMonth(r.receiptDate ?? "", targetMonth));
  const ytd = allReceipts.filter((r) => (r.receiptDate ?? "").startsWith(today.slice(0, 4)));
  const pacing = computeMonthPacing(allReceipts, targetMonth, today);
  const { reimbursableMinor, reimbursablePendingCount } = computeReimbursable(allReceipts, allTrips);
  const needsReviewCount = monthReceipts.filter((r) => r.status === "needs_review").length;
  const breakdown = computeCategoryBreakdown(monthReceipts);
  const weeklySpend = computeWeeklySpend(allReceipts, today);
  const outstandingThisMonth = monthReceipts.filter((r) => isOutstanding(r.reimbursementStatus));

  // No fabricated vendor-specific tip here (mock-api's hardcoded "you're paying
  // for Adobe and Zoom" would be a lie for a real workspace that doesn't use
  // either) — only tips genuinely derived from this workspace's own data.
  const tips: BudgetTip[] = [
    {
      iconLetter: "%",
      tone: "neutral",
      text: "Tax season prep: keep setting aside 10–15% of net income for deductible business expenses like these.",
    },
  ];
  if (outstandingThisMonth.length > 0) {
    tips.push({
      iconLetter: "!",
      tone: "warn",
      text: `${outstandingThisMonth.length} receipts are still awaiting payout — clearing them moves spend from pending into reimbursed.`,
    });
  }

  return {
    currency: ws.home_currency,
    stats: {
      monthTotalMinor: pacing.monthTotalMinor,
      monthDeltaPct: pacing.monthDeltaPct,
      ytdTotalMinor: ytd.reduce((s, r) => s + reclaimMinor(r), 0),
      ytdCount: ytd.length,
      taxMinor: monthReceipts.reduce((s, r) => s + (r.taxMinor ?? 0), 0),
      reimbursableMinor,
      reimbursablePendingCount,
      receiptCount: monthReceipts.length,
      needsReviewCount,
    },
    pacing: {
      prevMonthTotalMinor: pacing.prevMonthTotalMinor,
      prevMonthToDateMinor: pacing.prevMonthToDateMinor,
      elapsedFraction: pacing.elapsedFraction,
    },
    weeklySpend,
    categoryBreakdown: breakdown,
    tips,
    recentReceipts: [...allReceipts].sort((a, b) => (b.receiptDate ?? "").localeCompare(a.receiptDate ?? "")).slice(0, 5),
  };
}

/** See getDashboard's userId doc — same "omit for workspace-wide, pass caller's own id for personal-only" rule. */
export async function getOwedToUserSummary(userId?: string): Promise<OwedToUserSummary> {
  const [allReceipts, allTrips] = await Promise.all([fetchAllReceipts(userId), fetchAllTrips(userId)]);
  const outstandingReceipts = allReceipts.filter((r) => isOutstanding(r.reimbursementStatus));
  const { reimbursableMinor } = computeReimbursable(allReceipts, allTrips);
  return { amountMinor: reimbursableMinor, receiptCount: outstandingReceipts.length };
}

export async function getTeam(month?: string): Promise<TeamResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const targetMonth = month ?? today.slice(0, 7);

  const [ws, allReceipts, allTrips, users] = await Promise.all([
    getWorkspaceRow(),
    fetchAllReceipts(),
    fetchAllTrips(),
    listUsers(),
  ]);

  const monthReceipts = allReceipts.filter((r) => inMonth(r.receiptDate ?? "", targetMonth));
  const monthTrips = allTrips.filter((t) => inMonth(t.tripDate, targetMonth));
  const allOutstanding = allReceipts.filter((r) => isOutstanding(r.reimbursementStatus));
  const tripsOutstanding = allTrips.filter((t) => isOutstanding(t.reimbursementStatus));
  const mileageOutstandingMinor = tripsOutstanding.reduce((s, t) => s + t.amountMinor, 0);
  const members = computeTeamMemberSummaries(users, allReceipts, today);
  const agedOver30 = allOutstanding.filter((r) => daysBetween(r.receiptDate ?? today, today) > 30);

  return {
    currency: ws.home_currency,
    outstandingRefundMinor: allOutstanding.reduce((s, r) => s + reclaimMinor(r), 0) + mileageOutstandingMinor,
    outstandingRefundCount: allOutstanding.length + tripsOutstanding.length,
    agedOver30Minor: agedOver30.reduce((s, r) => s + reclaimMinor(r), 0),
    agedOver30Count: agedOver30.length,
    teamTotalMinor: monthReceipts.reduce((s, r) => s + reclaimMinor(r), 0),
    teamMileageTotalMinor: monthTrips.reduce((s, t) => s + t.amountMinor, 0),
    userCount: users.length,
    needsReviewCount:
      monthReceipts.filter((r) => r.reimbursementStatus === "pending").length +
      monthTrips.filter((t) => t.reimbursementStatus === "pending").length,
    topSpenderName: members[0]?.name ?? null,
    members,
    mileage: [...allTrips].sort((a, b) => b.tripDate.localeCompare(a.tripDate)),
    mileageRateMilli: ws.mileage_rate_milli,
    mileageOutstandingMinor,
  };
}
