/**
 * In-memory API used by both apps until Supabase is provisioned.
 *
 * Why this exists: the UI can be finished and previewed on a phone without waiting
 * on backend provisioning, and both apps develop against the SAME shaped responses
 * — so when the real API lands, swapping it in is a change of one module rather
 * than a rewrite of every screen.
 *
 * Every function here returns exactly the type the real endpoint will return.
 * If you need a field the API does not yet provide, add it to @rr/shared first.
 *
 * Data is derived from the sample records in design/dashboard.dc.html, converted
 * to euros and to integer minor units.
 */

import {
  SEED_CATEGORIES,
  daysBetween,
  formatMoney,
  reclaimMinor,
  mileageAmountMinor,
  MI_TO_KM,
  isOutstanding,
  inMonth,
  prevMonthOf,
  computeCategoryBreakdown,
  computeMonthPacing,
  computeWeeklySpend,
  computeReimbursable,
  computeTeamMemberSummaries,
  type DashboardResponse,
  type DistanceUnit,
  type MileageTrip,
  type Receipt,
  type ReimbursementStatus,
  type TeamResponse,
  type OwedToUserSummary,
  type Role,
} from "@rr/shared";

export const TODAY = "2026-07-18";
export const WORKSPACE_ID = "ws_0000";

/**
 * Home currency, and the rates used to express amounts in it.
 *
 * The seed data is denominated in EUR. Changing the workspace's home currency
 * re-expresses every amount at these rates so the number on screen actually
 * changes — relabelling €35.50 as "$35.50" without converting would be worse than
 * not offering the control at all.
 *
 * PLACEHOLDER RATES. The real implementation reads the ECB daily feed into the
 * fx_rates table and freezes a rate per receipt at scan time, so historical values
 * never drift. See DESIGN_V2_DELTA.md §4.2.
 */
const FX_FROM_EUR: Record<string, number> = {
  EUR: 1,
  USD: 1.09,
  GBP: 0.85,
  CHF: 0.94,
  CAD: 1.47,
  AUD: 1.63,
  JPY: 170.5,
  MXN: 19.8,
  INR: 91.2,
  BRL: 5.9,
};

export const SUPPORTED_CURRENCIES = Object.keys(FX_FROM_EUR);

let homeCurrency = "EUR";

export function getHomeCurrency(): string {
  return homeCurrency;
}

export function setHomeCurrency(code: string): void {
  if (FX_FROM_EUR[code] !== undefined) homeCurrency = code;
}

/**
 * Distance unit for mileage, a workspace setting rather than per-screen state.
 *
 * It has to be shared: the Mileage screen displays distances in it, and the Team
 * page quotes the rate per unit. Two screens deriving it independently is how they
 * end up disagreeing.
 */
let distanceUnit: DistanceUnit = "mi";

/**
 * Workspace mileage rate, in thousandths of a currency unit PER THE WORKSPACE'S
 * CURRENT DISTANCE UNIT.
 *
 * Stored in the entered unit, not converted to a canonical one. Statutory rates
 * are exact published figures — France's barème, the IRS's per-mile rate — and
 * round-tripping 0.665/km through a per-mile canonical value returns 0.66487/km,
 * which is a cent out over 100km. Trips are always logged in the workspace unit,
 * so the money path never converts at all.
 */
let mileageRatePerUnitMilli = 700;

export function getDistanceUnit(): DistanceUnit {
  return distanceUnit;
}

/**
 * Changing the unit converts the rate once, so the reimbursement stays worth
 * roughly the same rather than silently becoming 1.6x wrong. The user can then
 * type the exact statutory figure for the new unit.
 */
export function setDistanceUnit(unit: DistanceUnit): void {
  if (unit === distanceUnit) return;
  mileageRatePerUnitMilli = Math.round(
    unit === "km" ? mileageRatePerUnitMilli / MI_TO_KM : mileageRatePerUnitMilli * MI_TO_KM,
  );
  distanceUnit = unit;
}

export function getMileageRateMilli(): number {
  return mileageRatePerUnitMilli;
}

export function setMileageRateMilli(value: number): void {
  if (Number.isFinite(value) && value > 0) mileageRatePerUnitMilli = Math.round(value);
}

/** EUR minor units -> home-currency minor units. */
function toHome(minorEur: number): number {
  if (homeCurrency === "EUR") return minorEur;
  const rate = FX_FROM_EUR[homeCurrency] ?? 1;
  const scale = homeCurrency === "JPY" ? 1 / 100 : 1; // zero-decimal currency
  return Math.round(minorEur * rate * scale);
}

/**
 * Home-currency minor units -> EUR minor units (inverse of toHome).
 *
 * Receipts are stored in RECEIPTS as EUR, and only converted to the workspace's
 * home currency at the read boundary (see present()). A setter that receives a
 * value the user typed in the home currency has to convert it back before writing
 * to RECEIPTS, or it silently double-applies the FX rate on the next read.
 */
function fromHome(minorHome: number): number {
  if (homeCurrency === "EUR") return minorHome;
  const rate = FX_FROM_EUR[homeCurrency] ?? 1;
  const scale = homeCurrency === "JPY" ? 1 / 100 : 1;
  return Math.round(minorHome / (rate * scale));
}

/** @deprecated Read getHomeCurrency() — this is only the initial value. */
export const HOME_CURRENCY = "EUR";

export interface MockUser {
  id: string;
  name: string;
  role: Role;
  jobTitle: string;
}

export const USERS: MockUser[] = [
  { id: "u_1", name: "Xavier Torres-Tuset", role: "owner", jobTitle: "Owner" },
  { id: "u_2", name: "Mairead Bradley", role: "member", jobTitle: "Sales Manager" },
  { id: "u_3", name: "Malcolm Rowntree", role: "member", jobTitle: "Office Manager" },
  { id: "u_4", name: "Dag Henrikz", role: "member", jobTitle: "Field Technician" },
];

/** The signed-in user. Flip to a member id to exercise member-scoped views. */
export let CURRENT_USER: MockUser = USERS[0]!;
export function setCurrentUser(id: string): void {
  const found = USERS.find((u) => u.id === id);
  if (found) CURRENT_USER = found;
}

interface Seed {
  id: string;
  user: string;
  date: string;
  vendor: string;
  category: string;
  brand: string;
  last4: string;
  subtotal: number;
  tax: number;
  reimbursement: ReimbursementStatus;
  needsReview?: boolean;
  comment?: string;
  fx?: { currency: string; total: number; rate: number };
  items?: { desc: string; qty: number; unit: number }[];
}

const SEEDS: Seed[] = [
  { id: "r_31", user: "u_3", date: "2026-07-01", vendor: "Carrefour", category: "Groceries", brand: "Visa", last4: "4521", subtotal: 88.12, tax: 5.29, reimbursement: "reimbursed", items: [{ desc: "Office kitchen restock", qty: 1, unit: 88.12 }] },
  { id: "r_32", user: "u_4", date: "2026-07-03", vendor: "Starbucks", category: "Meals", brand: "Visa", last4: "4521", subtotal: 16.8, tax: 1.43, reimbursement: "reimbursed", items: [{ desc: "Client coffee", qty: 3, unit: 5.6 }] },
  { id: "r_33", user: "u_1", date: "2026-07-05", vendor: "Uber", category: "Travel", brand: "Amex", last4: "1002", subtotal: 33.75, tax: 0, reimbursement: "reimbursed", comment: "Client meeting with 2 attendees from Acme Corp.", fx: { currency: "CAD", total: 45.9, rate: 0.7353 }, items: [{ desc: "Ride to meeting", qty: 1, unit: 33.75 }] },
  { id: "r_34", user: "u_2", date: "2026-07-07", vendor: "Adobe", category: "Software", brand: "Amex", last4: "1002", subtotal: 59.99, tax: 5.1, reimbursement: "reimbursed", items: [{ desc: "Creative Cloud subscription", qty: 1, unit: 59.99 }] },
  { id: "r_35", user: "u_3", date: "2026-07-08", vendor: "Zoom", category: "Software", brand: "Visa", last4: "4521", subtotal: 149.9, tax: 12.74, reimbursement: "reimbursed", items: [{ desc: "Business plan, annual prorate", qty: 1, unit: 149.9 }] },
  { id: "r_36", user: "u_4", date: "2026-07-09", vendor: "Total Energies", category: "Fuel", brand: "CB", last4: "XX19", subtotal: 49.6, tax: 0, reimbursement: "reimbursed", items: [{ desc: "Unleaded fuel", qty: 1, unit: 49.6 }] },
  { id: "r_37", user: "u_1", date: "2026-07-10", vendor: "LinkedIn Ads", category: "Marketing", brand: "Visa", last4: "4521", subtotal: 180, tax: 0, reimbursement: "pending", needsReview: true, items: [{ desc: "Sponsored content campaign", qty: 1, unit: 180 }] },
  { id: "r_38", user: "u_2", date: "2026-07-11", vendor: "Fnac", category: "Office Supplies", brand: "Visa", last4: "4521", subtotal: 129, tax: 10.97, reimbursement: "approved", items: [{ desc: "External monitor", qty: 1, unit: 129 }] },
  { id: "r_39", user: "u_3", date: "2026-07-13", vendor: "Leroy Merlin", category: "Other", brand: "CB", last4: "XX19", subtotal: 64.3, tax: 5.47, reimbursement: "pending", items: [{ desc: "Office repair supplies", qty: 1, unit: 64.3 }] },
  { id: "r_40", user: "u_4", date: "2026-07-14", vendor: "Paul", category: "Meals", brand: "Visa", last4: "4521", subtotal: 24.6, tax: 2.09, reimbursement: "pending", items: [{ desc: "Staff lunch", qty: 4, unit: 6.15 }] },
  { id: "r_41", user: "u_1", date: "2026-07-15", vendor: "EDF", category: "Utilities", brand: "CB", last4: "XX19", subtotal: 184.2, tax: 0, reimbursement: "rejected", items: [{ desc: "Office electricity, monthly", qty: 1, unit: 184.2 }] },
  { id: "r_42", user: "u_2", date: "2026-07-16", vendor: "Hertz", category: "Travel", brand: "Amex", last4: "1002", subtotal: 142.5, tax: 0, reimbursement: "approved", items: [{ desc: "Rental car, 2 days", qty: 2, unit: 71.25 }] },
  { id: "r_43", user: "u_3", date: "2026-07-17", vendor: "Pharmacie Centrale", category: "Other", brand: "Visa", last4: "4521", subtotal: 22.3, tax: 1.6, reimbursement: "pending", needsReview: true, items: [{ desc: "Office first aid kit", qty: 1, unit: 22.3 }] },
  { id: "r_44", user: "u_4", date: "2026-07-18", vendor: "Le Bistrot", category: "Meals", brand: "Amex", last4: "1002", subtotal: 96.4, tax: 8.19, reimbursement: "pending", needsReview: true, comment: "Client dinner, party of 4.", items: [{ desc: "Client dinner, party of 4", qty: 1, unit: 96.4 }] },
  // Previous month, for the delta and the 6-week chart.
  { id: "r_25", user: "u_1", date: "2026-06-14", vendor: "Google Ads", category: "Marketing", brand: "Visa", last4: "4521", subtotal: 400, tax: 0, reimbursement: "reimbursed", items: [{ desc: "Search ad campaign", qty: 1, unit: 400 }] },
  { id: "r_26", user: "u_2", date: "2026-06-16", vendor: "Carrefour", category: "Groceries", brand: "CB", last4: "XX19", subtotal: 168.55, tax: 0, reimbursement: "reimbursed", items: [{ desc: "Office pantry restock", qty: 1, unit: 168.55 }] },
  { id: "r_27", user: "u_3", date: "2026-06-19", vendor: "Air France", category: "Travel", brand: "Amex", last4: "1002", subtotal: 486, tax: 0, reimbursement: "approved", items: [{ desc: "Round-trip flight, conference", qty: 1, unit: 486 }] },
  { id: "r_28", user: "u_4", date: "2026-06-22", vendor: "Bureau Vallée", category: "Office Supplies", brand: "Visa", last4: "4521", subtotal: 41.7, tax: 3.54, reimbursement: "reimbursed", items: [{ desc: "Printer ink cartridges", qty: 2, unit: 20.85 }] },
  { id: "r_29", user: "u_1", date: "2026-06-25", vendor: "Chipotle", category: "Meals", brand: "CB", last4: "XX19", subtotal: 28.9, tax: 2.46, reimbursement: "reimbursed", items: [{ desc: "Team lunch", qty: 2, unit: 14.45 }] },
  { id: "r_30", user: "u_2", date: "2026-06-28", vendor: "Cabinet Nguyen", category: "Professional Services", brand: "Amex", last4: "1002", subtotal: 275, tax: 0, reimbursement: "reimbursed", items: [{ desc: "Tax filing prep", qty: 1, unit: 275 }] },
];

const cents = (n: number) => Math.round(n * 100);

const RECEIPTS: Receipt[] = SEEDS.map((s) => ({
  id: s.id,
  workspaceId: WORKSPACE_ID,
  createdBy: s.user,
  status: s.needsReview ? "needs_review" : "processed",
  imagePath: null,
  vendor: s.vendor,
  receiptDate: s.date,
  categoryId: `cat_${s.category.toLowerCase().replace(/\s+/g, "_")}`,
  categoryName: s.category,
  currency: HOME_CURRENCY,
  subtotalMinor: cents(s.subtotal),
  taxMinor: cents(s.tax),
  totalMinor: cents(s.subtotal) + cents(s.tax),
  // Null = claim the whole total, which is the normal case.
  reclaimMinor: null,
  originalCurrency: s.fx?.currency ?? null,
  originalTotalMinor: s.fx ? cents(s.fx.total) : null,
  fxRate: s.fx?.rate ?? null,
  fxRateDate: s.fx ? s.date : null,
  country: null,
  paymentBrand: s.brand,
  paymentLast4: s.last4,
  paymentType: s.brand === "CB" ? "debit" : "credit",
  comment: s.comment ?? null,
  reimbursementStatus: s.reimbursement,
  rejectionReason:
    s.reimbursement === "rejected"
      ? "Duplicate utility bill — already reimbursed under a separate account for this billing period."
      : null,
  extractionConfidence: s.needsReview ? 0.62 : 0.97,
  lineItems: (s.items ?? []).map((li, i) => ({
    id: `${s.id}_li_${i}`,
    description: li.desc,
    quantity: li.qty,
    unitPriceMinor: cents(li.unit),
    amountMinor: Math.round(li.qty * cents(li.unit)),
  })),
  createdAt: `${s.date}T10:00:00Z`,
}));

// Starts well past the seed ids (they only go up to r_44) so a newly captured
// receipt can never collide with one already in RECEIPTS.
let nextReceiptSeq = 1000;

/**
 * Add a manually- or OCR-filled receipt. Was missing entirely — the Confirm
 * screen's "Save receipt" only wrote a summary for the confirmation toast, so a
 * captured receipt never actually joined RECEIPTS and could not appear in the
 * list, the dashboard, or any other aggregate.
 *
 * `totalMinor`/`taxMinor` arrive in the workspace's home currency (what the
 * Confirm screen displayed and validated); converted back to the EUR base via
 * fromHome(), same as setReclaimMinor.
 */
export function addReceipt(input: {
  vendor: string;
  receiptDate: string | null;
  totalMinor: number;
  taxMinor: number;
  categoryName: string;
  comment: string;
  paymentBrand: string | null;
  paymentLast4: string | null;
  imagePath: string | null;
}): Receipt {
  const totalEur = fromHome(input.totalMinor);
  const taxEur = fromHome(input.taxMinor);
  const receipt: Receipt = {
    id: `r_${nextReceiptSeq++}`,
    workspaceId: WORKSPACE_ID,
    createdBy: CURRENT_USER.id,
    status: "processed",
    imagePath: input.imagePath,
    vendor: input.vendor || null,
    receiptDate: input.receiptDate,
    categoryId: `cat_${input.categoryName.toLowerCase().replace(/\s+/g, "_")}`,
    categoryName: input.categoryName,
    currency: HOME_CURRENCY,
    subtotalMinor: totalEur - taxEur,
    taxMinor: taxEur,
    totalMinor: totalEur,
    reclaimMinor: null,
    originalCurrency: null,
    originalTotalMinor: null,
    fxRate: null,
    fxRateDate: null,
    country: null,
    paymentBrand: input.paymentBrand,
    paymentLast4: input.paymentLast4,
    paymentType: null,
    comment: input.comment || null,
    reimbursementStatus: "pending",
    rejectionReason: null,
    extractionConfidence: null,
    lineItems: [],
    createdAt: new Date().toISOString(),
  };
  RECEIPTS.push(receipt);
  return present(receipt);
}

// Thousandths of a euro: 0.700/mi. Three decimals because statutory mileage
// rates are quoted that way.
/** Rate the seed trips were logged at. New trips use the current workspace rate. */
const MILEAGE_RATE_MILLI = 700;

const TRIPS: MileageTrip[] = [
  { id: "t_1", workspaceId: WORKSPACE_ID, userId: "u_4", tripDate: "2026-07-02", purpose: "Client site visit", distance: 18.4, distanceUnit: "mi", rateMilli: MILEAGE_RATE_MILLI, rateUnit: "mi", amountMinor: mileageAmountMinor(18.4, MILEAGE_RATE_MILLI, HOME_CURRENCY), reimbursementStatus: "reimbursed", rejectionReason: null, startAddress: null, endAddress: null },
  { id: "t_2", workspaceId: WORKSPACE_ID, userId: "u_2", tripDate: "2026-07-06", purpose: "Vendor meeting", distance: 9.2, distanceUnit: "mi", rateMilli: MILEAGE_RATE_MILLI, rateUnit: "mi", amountMinor: mileageAmountMinor(9.2, MILEAGE_RATE_MILLI, HOME_CURRENCY), reimbursementStatus: "approved", rejectionReason: null, startAddress: null, endAddress: null },
  { id: "t_3", workspaceId: WORKSPACE_ID, userId: "u_4", tripDate: "2026-07-09", purpose: "Airport pickup", distance: 24.6, distanceUnit: "mi", rateMilli: MILEAGE_RATE_MILLI, rateUnit: "mi", amountMinor: mileageAmountMinor(24.6, MILEAGE_RATE_MILLI, HOME_CURRENCY), reimbursementStatus: "pending", rejectionReason: null, startAddress: null, endAddress: null },
  { id: "t_4", workspaceId: WORKSPACE_ID, userId: "u_3", tripDate: "2026-07-13", purpose: "Supply run", distance: 6.1, distanceUnit: "mi", rateMilli: MILEAGE_RATE_MILLI, rateUnit: "mi", amountMinor: mileageAmountMinor(6.1, MILEAGE_RATE_MILLI, HOME_CURRENCY), reimbursementStatus: "pending", rejectionReason: null, startAddress: null, endAddress: null },
  { id: "t_5", workspaceId: WORKSPACE_ID, userId: "u_4", tripDate: "2026-07-16", purpose: "Client site visit", distance: 18.4, distanceUnit: "mi", rateMilli: MILEAGE_RATE_MILLI, rateUnit: "mi", amountMinor: mileageAmountMinor(18.4, MILEAGE_RATE_MILLI, HOME_CURRENCY), reimbursementStatus: "pending", rejectionReason: null, startAddress: null, endAddress: null },
];

/**
 * Members see only their own receipts; owners/admins see the workspace. Mirrors
 * RLS. The exact same rule applies to mileage trips (visibleTrips, below) —
 * kept as two functions rather than one generic one only because Receipt uses
 * `createdBy` and MileageTrip uses `userId`, not because the rule differs.
 */
function visibleReceipts(): Receipt[] {
  if (CURRENT_USER.role === "owner" || CURRENT_USER.role === "admin") return RECEIPTS;
  return RECEIPTS.filter((r) => r.createdBy === CURRENT_USER.id);
}

/** Same rule as visibleReceipts, for mileage trips. */
function visibleTrips(): MileageTrip[] {
  if (CURRENT_USER.role === "owner" || CURRENT_USER.role === "admin") return TRIPS;
  return TRIPS.filter((t) => t.userId === CURRENT_USER.id);
}

/**
 * Re-express a stored (EUR) receipt in the workspace's home currency.
 *
 * Applied at the read boundary so every screen sees amounts in one currency and
 * no component has to know conversion exists.
 */
function present(r: Receipt): Receipt {
  if (homeCurrency === "EUR") return r;
  return {
    ...r,
    currency: homeCurrency,
    subtotalMinor: r.subtotalMinor === null ? null : toHome(r.subtotalMinor),
    taxMinor: r.taxMinor === null ? null : toHome(r.taxMinor),
    totalMinor: toHome(r.totalMinor),
    reclaimMinor: r.reclaimMinor === null ? null : toHome(r.reclaimMinor),
    lineItems: r.lineItems.map((li) => ({
      ...li,
      unitPriceMinor: toHome(li.unitPriceMinor),
      amountMinor: toHome(li.amountMinor),
    })),
  };
}

function presentTrip(t: MileageTrip): MileageTrip {
  if (homeCurrency === "EUR") return t;
  return { ...t, rateMilli: Math.round(toHome(t.rateMilli * 10) / 10), amountMinor: toHome(t.amountMinor) };
}

export function listReceipts(opts: { month?: string; categoryName?: string; userId?: string; q?: string } = {}): Receipt[] {
  return visibleReceipts()
    .filter((r) => (opts.month ? inMonth(r.receiptDate ?? "", opts.month) : true))
    .filter((r) => (opts.categoryName && opts.categoryName !== "All" ? r.categoryName === opts.categoryName : true))
    .filter((r) => (opts.userId && opts.userId !== "All" ? r.createdBy === opts.userId : true))
    .filter((r) => (opts.q ? (r.vendor ?? "").toLowerCase().includes(opts.q.toLowerCase()) : true))
    .sort((a, b) => (b.receiptDate ?? "").localeCompare(a.receiptDate ?? ""))
    .map(present);
}

export function getReceipt(id: string): Receipt | undefined {
  const found = visibleReceipts().find((r) => r.id === id);
  return found ? present(found) : undefined;
}

export function setReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): void {
  const r = RECEIPTS.find((x) => x.id === id);
  if (!r) return;
  r.reimbursementStatus = status;
  r.rejectionReason = status === "rejected" ? (reason ?? null) : null;
}

/**
 * Delete a receipt. Only permitted while pending.
 *
 * Once a claim has been approved, paid, or formally rejected it is part of the
 * reimbursement record — deleting it would remove the evidence behind a payment
 * that actually happened. Returns false if the receipt is not deletable, so the
 * caller can say why rather than silently doing nothing.
 */
export function deleteReceipt(id: string): boolean {
  const index = RECEIPTS.findIndex((r) => r.id === id);
  if (index === -1) return false;

  const receipt = RECEIPTS[index]!;
  if (receipt.reimbursementStatus !== "pending") return false;
  // Members may only delete their own.
  if (CURRENT_USER.role === "member" && receipt.createdBy !== CURRENT_USER.id) return false;

  RECEIPTS.splice(index, 1);
  return true;
}

export function setCategory(id: string, categoryName: string): void {
  const r = RECEIPTS.find((x) => x.id === id);
  if (r) r.categoryName = categoryName;
}

export function setComment(id: string, comment: string): void {
  const r = RECEIPTS.find((x) => x.id === id);
  if (r) r.comment = comment;
}

/**
 * `minorHomeCurrency` is what the user typed, already in the workspace's home
 * currency — the same units the screen validated against receipt.totalMinor.
 * Converted back to EUR before writing so every aggregate that reads RECEIPTS
 * directly (dashboard, owed-to-user, team, category breakdown) picks up the
 * edit immediately, not just the screen that made it.
 */
export function setReclaimMinor(id: string, minorHomeCurrency: number): void {
  const r = RECEIPTS.find((x) => x.id === id);
  if (r) r.reclaimMinor = fromHome(minorHomeCurrency);
}

export function getDashboard(month = "2026-07"): DashboardResponse {
  const all = visibleReceipts();
  const monthReceipts = all.filter((r) => inMonth(r.receiptDate ?? "", month));
  const ytd = all.filter((r) => (r.receiptDate ?? "").startsWith("2026"));

  const pacing = computeMonthPacing(all, month, TODAY);

  // "Reimbursable to employees" is what the business currently owes, not what it
  // owed this month — a receipt or trip from last month that is still pending
  // doesn't stop counting just because the calendar page turned. No month
  // restriction, same reasoning as getOwedToUserSummary. Receipts AND mileage:
  // both are real money the business owes, and a trip pending payout is no
  // different from a receipt pending payout from this stat's point of view.
  const { reimbursableMinor, reimbursablePendingCount } = computeReimbursable(all, visibleTrips());

  const needsReviewCount = monthReceipts.filter((r) => r.status === "needs_review").length;
  const breakdown = computeCategoryBreakdown(monthReceipts);
  const weeklySpend = computeWeeklySpend(all, TODAY);

  // Still month-scoped on purpose, unlike reimbursableMinor above — this tip is
  // about clearing this month's backlog specifically, not the whole business's.
  const outstandingThisMonth = monthReceipts.filter((r) => isOutstanding(r.reimbursementStatus));

  // Everything above is computed in EUR, the currency the seed data is stored in.
  // Convert on the way out, so percentages and counts stay currency-independent
  // and only the amounts move. Converting earlier would have meant rounding twice.
  return {
    currency: homeCurrency,
    stats: {
      monthTotalMinor: toHome(pacing.monthTotalMinor),
      monthDeltaPct: pacing.monthDeltaPct,
      ytdTotalMinor: toHome(ytd.reduce((s, r) => s + reclaimMinor(r), 0)),
      ytdCount: ytd.length,
      taxMinor: toHome(monthReceipts.reduce((s, r) => s + (r.taxMinor ?? 0), 0)),
      reimbursableMinor: toHome(reimbursableMinor),
      reimbursablePendingCount,
      receiptCount: monthReceipts.length,
      needsReviewCount,
    },
    pacing: {
      prevMonthTotalMinor: toHome(pacing.prevMonthTotalMinor),
      prevMonthToDateMinor: toHome(pacing.prevMonthToDateMinor),
      elapsedFraction: pacing.elapsedFraction,
    },
    weeklySpend: weeklySpend.map((w) => ({ ...w, totalMinor: toHome(w.totalMinor) })),
    categoryBreakdown: breakdown.map((c) => ({ ...c, amountMinor: toHome(c.amountMinor) })),
    tips: [
      {
        iconLetter: "$",
        tone: "positive",
        text: `You're paying for Adobe and Zoom (${formatMoney(toHome(22773), homeCurrency)} this month) — review for overlapping tools before renewal.`,
      },
      { iconLetter: "%", tone: "neutral", text: "Tax season prep: keep setting aside 10–15% of net income for deductible business expenses like these." },
      { iconLetter: "!", tone: "warn", text: `${outstandingThisMonth.length} receipts are still awaiting payout — clearing them moves spend from pending into reimbursed.` },
    ],
    recentReceipts: listReceipts().slice(0, 5),
  };
}

/**
 * Personal outstanding balance for the signed-in user: every receipt and mileage
 * trip they submitted that is still pending or approved. Reimbursed is excluded
 * because it has been paid; rejected is excluded because it is not awaiting
 * anything — neither is money "owed".
 *
 * Deliberately has no date restriction. "Owed to you" is a running balance, not
 * a monthly figure — a claim submitted three weeks ago that is still unpaid must
 * not silently drop out of this number the moment the calendar rolls into a new
 * month, since nothing has actually been paid.
 *
 * Always scoped to CURRENT_USER's own submissions regardless of role. An admin's
 * personal "owed to you" must not include what the workspace owes everyone
 * else — that is the Team page's outstandingRefundMinor, a different figure.
 *
 * amountMinor and receiptCount come from the same filtered set on purpose — see
 * OwedToUserSummary in shared/types.ts for why they are returned together rather
 * than as two separately-computed numbers.
 */
export function getOwedToUserSummary(): OwedToUserSummary {
  // visibleReceipts()/visibleTrips(): the same role rule as everywhere else in
  // this file. A member's own claims; an owner/admin's whole workspace — an
  // admin is the one responsible for clearing the backlog, so "owed to you" for
  // them means "outstanding in the business", the same population getTeam's
  // outstandingRefundMinor totals. Previously hardcoded to createdBy ===
  // CURRENT_USER.id regardless of role, which undercounted an admin's figure
  // down to just their own handful of receipts instead of the workspace's.
  const outstandingReceipts = visibleReceipts().filter((r) => isOutstanding(r.reimbursementStatus));
  const { reimbursableMinor } = computeReimbursable(visibleReceipts(), visibleTrips());
  return {
    amountMinor: toHome(reimbursableMinor),
    // Receipts only — mileage trips are not "receipts". computeReimbursable's
    // count mixes both, so this is filtered separately.
    receiptCount: outstandingReceipts.length,
  };
}

export function getTeam(month = "2026-07"): TeamResponse {
  const monthReceipts = RECEIPTS.filter((r) => inMonth(r.receiptDate ?? "", month));
  const monthTrips = TRIPS.filter((t) => inMonth(t.tripDate, month));
  const allOutstanding = RECEIPTS.filter((r) => isOutstanding(r.reimbursementStatus));
  const tripsOutstanding = TRIPS.filter((t) => isOutstanding(t.reimbursementStatus));
  const mileageOutstandingMinor = tripsOutstanding.reduce((s, t) => s + t.amountMinor, 0);

  // outstandingMinor per member is converted to the display currency AFTER
  // sorting inside computeTeamMemberSummaries — safe, since toHome is a fixed
  // positive scale factor and preserves order.
  const members = computeTeamMemberSummaries(USERS, RECEIPTS, TODAY).map((m) => ({
    ...m,
    outstandingMinor: toHome(m.outstandingMinor),
  }));

  const agedOver30 = allOutstanding.filter((r) => daysBetween(r.receiptDate ?? TODAY, TODAY) > 30);

  return {
    currency: homeCurrency,
    outstandingRefundMinor: toHome(
      allOutstanding.reduce((s, r) => s + reclaimMinor(r), 0) + mileageOutstandingMinor,
    ),
    outstandingRefundCount: allOutstanding.length + tripsOutstanding.length,
    agedOver30Minor: toHome(agedOver30.reduce((s, r) => s + reclaimMinor(r), 0)),
    agedOver30Count: agedOver30.length,
    teamTotalMinor: toHome(monthReceipts.reduce((s, r) => s + reclaimMinor(r), 0)),
    teamMileageTotalMinor: toHome(monthTrips.reduce((s, t) => s + t.amountMinor, 0)),
    userCount: USERS.length,
    needsReviewCount:
      monthReceipts.filter((r) => r.reimbursementStatus === "pending").length +
      monthTrips.filter((t) => t.reimbursementStatus === "pending").length,
    topSpenderName: members[0]?.name ?? null,
    members,
    mileage: [...TRIPS].sort((a, b) => b.tripDate.localeCompare(a.tripDate)).map(presentTrip),
    mileageRateMilli: Math.round(toHome(mileageRatePerUnitMilli * 10) / 10),
    mileageOutstandingMinor: toHome(mileageOutstandingMinor),
  };
}

export function listMileage(userId?: string): MileageTrip[] {
  return visibleTrips()
    .filter((t) => (userId && userId !== "All" ? t.userId === userId : true))
    .sort((a, b) => b.tripDate.localeCompare(a.tripDate))
    .map(presentTrip);
}

export function addMileageTrip(input: {
  tripDate: string;
  purpose: string;
  distance: number;
  distanceUnit: "mi" | "km";
  startAddress?: string | null;
  endAddress?: string | null;
}): MileageTrip {
  const trip: MileageTrip = {
    id: `t_${TRIPS.length + 1}`,
    workspaceId: WORKSPACE_ID,
    userId: CURRENT_USER.id,
    tripDate: input.tripDate,
    purpose: input.purpose,
    distance: input.distance,
    distanceUnit: input.distanceUnit,
    // Current workspace rate, frozen onto this trip. Existing trips keep theirs.
    rateMilli: mileageRatePerUnitMilli,
    rateUnit: distanceUnit,
    // Rate and distance are both in the workspace unit, so this is a direct
    // multiply with no conversion — which is what keeps 100 km at 0.665 exactly
    // 66.50 rather than a cent out.
    amountMinor: mileageAmountMinor(input.distance, mileageRatePerUnitMilli, HOME_CURRENCY),
    reimbursementStatus: "pending",
    rejectionReason: null,
    startAddress: input.startAddress ?? null,
    endAddress: input.endAddress ?? null,
  };
  TRIPS.push(trip);
  return trip;
}

/**
 * What a trip WOULD be worth if saved now.
 *
 * Exists so the "Estimated reimbursement" line and the saved amount cannot
 * disagree: both read the same rate from the same place. Previously the screen
 * estimated from its own cached copy of the rate while addMileageTrip used the
 * live one, and the two drifted apart.
 */
export function estimateMileageAmountMinor(distance: number, unit: DistanceUnit): number {
  if (unit !== distanceUnit) {
    // Should not happen — trips are logged in the workspace unit — but convert
    // rather than silently multiplying mismatched units.
    const inWorkspaceUnit = unit === "km" ? distance / MI_TO_KM : distance * MI_TO_KM;
    return mileageAmountMinor(inWorkspaceUnit, mileageRatePerUnitMilli, HOME_CURRENCY);
  }
  return mileageAmountMinor(distance, mileageRatePerUnitMilli, HOME_CURRENCY);
}

/**
 * Edit a pending trip. Frozen once approved, paid, or rejected — same rule as
 * receipt amounts.
 *
 * The amount is recomputed from the trip's OWN frozen rate, not the current
 * workspace rate: correcting a distance must not silently reprice a trip at
 * today's rate if the workspace rate has changed since it was logged.
 */
export function updateMileageTrip(
  id: string,
  patch: { tripDate?: string; purpose?: string; distance?: number },
): MileageTrip | null {
  const trip = TRIPS.find((t) => t.id === id);
  if (!trip) return null;
  if (trip.reimbursementStatus !== "pending") return null;
  if (CURRENT_USER.role === "member" && trip.userId !== CURRENT_USER.id) return null;

  if (patch.tripDate !== undefined) trip.tripDate = patch.tripDate;
  if (patch.purpose !== undefined) trip.purpose = patch.purpose;
  if (patch.distance !== undefined && patch.distance > 0) {
    trip.distance = patch.distance;
    trip.amountMinor = mileageAmountMinor(patch.distance, trip.rateMilli, HOME_CURRENCY);
  }
  return trip;
}

/** Delete a pending trip. Same reasoning as deleteReceipt. */
export function deleteMileageTrip(id: string): boolean {
  const index = TRIPS.findIndex((t) => t.id === id);
  if (index === -1) return false;

  const trip = TRIPS[index]!;
  if (trip.reimbursementStatus !== "pending") return false;
  if (CURRENT_USER.role === "member" && trip.userId !== CURRENT_USER.id) return false;

  TRIPS.splice(index, 1);
  return true;
}

export function listCategories(): string[] {
  return [...SEED_CATEGORIES];
}

export function userName(id: string): string {
  return USERS.find((u) => u.id === id)?.name ?? "Unknown";
}
