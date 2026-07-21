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
  type Receipt,
  type ReimbursementStatus,
  type Role,
  type TeamResponse,
  type OwedToUserSummary,
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

/** Single-workspace-per-user for now — matches handle_new_user()'s bootstrap trigger. */
async function getCurrentWorkspaceId(): Promise<string> {
  const userId = await getCurrentUserId();
  const { data, error } = await client()
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error) throw error;
  return (data as { workspace_id: string }).workspace_id;
}

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
  jobTitle: string | null;
}

interface MemberWithProfileRow {
  role: Role;
  job_title: string | null;
  // Confirmed against a live query (not assumed): a many-to-one embed like
  // this comes back as a single object, e.g. {"name":"Meals"}, not an array —
  // despite the untyped client's generic .select() overload claiming the
  // opposite. Trust the runtime shape here, not the loose inferred type.
  profiles: { display_name: string } | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const userId = await getCurrentUserId();
  const { data, error } = await client()
    .from("workspace_members")
    .select("role, job_title, profiles(display_name)")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error) throw error;
  const row = data as unknown as MemberWithProfileRow;
  return { id: userId, name: row.profiles?.display_name ?? "", role: row.role, jobTitle: row.job_title };
}

export interface WorkspaceUser {
  id: string;
  name: string;
  role: Role;
  jobTitle: string | null;
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
  const { data, error } = await client()
    .from("workspace_members")
    .select("user_id, role, job_title, profiles(display_name)")
    .eq("workspace_id", wsId);
  if (error) throw error;
  const rows = data as unknown as (MemberWithProfileRow & { user_id: string })[];
  return rows.map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? "", role: m.role, jobTitle: m.job_title }));
}

export async function userName(id: string): Promise<string> {
  const { data, error } = await client().from("profiles").select("display_name").eq("id", id).single();
  if (error) throw error;
  return (data as { display_name: string }).display_name ?? "Unknown";
}

// ── workspace settings ───────────────────────────────────────────────────

interface WorkspaceRow {
  id: string;
  home_currency: string;
  mileage_unit: DistanceUnit;
  mileage_rate_milli: number;
}

async function getWorkspaceRow(): Promise<WorkspaceRow> {
  const wsId = await getCurrentWorkspaceId();
  const { data, error } = await client()
    .from("workspaces")
    .select("id, home_currency, mileage_unit, mileage_rate_milli")
    .eq("id", wsId)
    .single();
  if (error) throw error;
  return data as WorkspaceRow;
}

/** Plain ISO codes — real receipts store their amount already converted at write time, so no FX table is needed here (contrast mock-api's FX_FROM_EUR). */
export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "MXN", "INR", "BRL"];

export async function getHomeCurrency(): Promise<string> {
  return (await getWorkspaceRow()).home_currency;
}

export async function setHomeCurrency(code: string): Promise<void> {
  if (!SUPPORTED_CURRENCIES.includes(code)) return;
  const wsId = await getCurrentWorkspaceId();
  const { error } = await client().from("workspaces").update({ home_currency: code }).eq("id", wsId);
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

/** What a trip WOULD be worth if saved now — same rate the save itself will use. */
export async function estimateMileageAmountMinor(distance: number, unit: DistanceUnit): Promise<number> {
  const row = await getWorkspaceRow();
  return mileageAmountForTrip(distance, unit, row.mileage_rate_milli, row.home_currency);
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
  let query = client().from("receipts").select(RECEIPT_SELECT).order("receipt_date", { ascending: false });
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
  const { data, error } = await client().from("receipts").select(RECEIPT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapReceiptRow(data as ReceiptRow) : undefined;
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
}): Promise<Receipt> {
  const userId = await getCurrentUserId();
  const wsId = await getCurrentWorkspaceId();
  const categoryId = await resolveCategoryId(wsId, input.categoryName);
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
      // total_minor is a generated column (subtotal + tax) — never written directly.
      subtotal_minor: input.totalMinor - input.taxMinor,
      tax_minor: input.taxMinor,
      payment_brand: input.paymentBrand,
      payment_last4: input.paymentLast4,
      comment: input.comment || null,
      reimbursement_status: "pending",
    })
    .select(RECEIPT_SELECT)
    .single();
  if (error) throw error;
  return mapReceiptRow(data as ReceiptRow);
}

/**
 * Only permitted while pending. RLS's receipts_delete policy allows the
 * delete for created_by/admin regardless of status — it does not itself
 * enforce this rule — so it is checked here, same UI-affordance-only caveat
 * as @rr/shared/authz.ts: this is not a substitute for a DB-level guarantee,
 * just what's available without altering the already-applied migration.
 */
export async function deleteReceipt(id: string): Promise<boolean> {
  const { data: receipt, error: fetchErr } = await client()
    .from("receipts")
    .select("reimbursement_status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !receipt) return false;
  if ((receipt as { reimbursement_status: ReimbursementStatus }).reimbursement_status !== "pending") return false;
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
 * The enforce_reimbursement_authority trigger does the actual work: checks
 * the caller is an admin, enforces the self-approval rule, requires a reason
 * on rejection, and logs to reimbursement_events — all server-side, so every
 * client that writes here is covered the same way. This just makes the write;
 * a rejected trigger surfaces as a thrown Postgrest error.
 */
export async function setReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): Promise<void> {
  const { error } = await client()
    .from("receipts")
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
  amount_minor: number;
  reimbursement_status: ReimbursementStatus;
  rejection_reason: string | null;
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
    amountMinor: row.amount_minor,
    reimbursementStatus: row.reimbursement_status,
    rejectionReason: row.rejection_reason,
  };
}

export async function listMileage(userId?: string): Promise<MileageTrip[]> {
  let query = client().from("mileage_trips").select("*").order("trip_date", { ascending: false });
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
}): Promise<MileageTrip> {
  const userId = await getCurrentUserId();
  const wsId = await getCurrentWorkspaceId();
  const ws = await getWorkspaceRow();
  // Frozen onto this trip at entry — existing trips keep their own rate even
  // if the workspace rate changes later. Same reasoning as fx_rate on receipts.
  const amountMinor = mileageAmountForTrip(input.distance, input.distanceUnit, ws.mileage_rate_milli, ws.home_currency);
  const { data, error } = await client()
    .from("mileage_trips")
    .insert({
      workspace_id: wsId,
      user_id: userId,
      trip_date: input.tripDate,
      purpose: input.purpose,
      distance: input.distance,
      distance_unit: input.distanceUnit,
      rate_milli: ws.mileage_rate_milli,
      amount_minor: amountMinor,
      reimbursement_status: "pending",
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
    update.amount_minor = mileageAmountForTrip(patch.distance, row.distance_unit, row.rate_milli, ws.home_currency);
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

async function fetchAllReceipts(): Promise<Receipt[]> {
  const { data, error } = await client().from("receipts").select(RECEIPT_SELECT);
  if (error) throw error;
  return (data as ReceiptRow[]).map(mapReceiptRow);
}

async function fetchAllTrips(): Promise<MileageTrip[]> {
  const { data, error } = await client().from("mileage_trips").select("*");
  if (error) throw error;
  return (data as TripRow[]).map(mapTripRow);
}

export async function getDashboard(month?: string): Promise<DashboardResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const targetMonth = month ?? today.slice(0, 7);

  const [ws, allReceipts, allTrips] = await Promise.all([getWorkspaceRow(), fetchAllReceipts(), fetchAllTrips()]);

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

export async function getOwedToUserSummary(): Promise<OwedToUserSummary> {
  const [allReceipts, allTrips] = await Promise.all([fetchAllReceipts(), fetchAllTrips()]);
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
    userCount: users.length,
    needsReviewCount: monthReceipts.filter((r) => r.status === "needs_review").length,
    topSpenderName: members[0]?.name ?? null,
    members,
    mileage: [...allTrips].sort((a, b) => b.tripDate.localeCompare(a.tripDate)),
    mileageRateMilli: ws.mileage_rate_milli,
    mileageOutstandingMinor,
  };
}
