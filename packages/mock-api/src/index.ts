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
  computeHealth,
  SEED_CATEGORIES,
  derivedHue,
  daysBetween,
  type CategoryBreakdownRow,
  type DashboardResponse,
  type MileageTrip,
  type Receipt,
  type ReimbursementStatus,
  type TeamMemberSummary,
  type TeamResponse,
  type Role,
} from "@rr/shared";

export const TODAY = "2026-07-18";
export const HOME_CURRENCY = "EUR";
export const WORKSPACE_ID = "ws_0000";

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
  originalCurrency: s.fx?.currency ?? null,
  originalTotalMinor: s.fx ? cents(s.fx.total) : null,
  fxRate: s.fx?.rate ?? null,
  fxRateDate: s.fx ? s.date : null,
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

const MILEAGE_RATE_MINOR = 70;

const TRIPS: MileageTrip[] = [
  { id: "t_1", workspaceId: WORKSPACE_ID, userId: "u_4", tripDate: "2026-07-02", purpose: "Client site visit", distance: 18.4, distanceUnit: "mi", rateMinor: MILEAGE_RATE_MINOR, amountMinor: Math.round(18.4 * MILEAGE_RATE_MINOR), reimbursementStatus: "reimbursed", rejectionReason: null },
  { id: "t_2", workspaceId: WORKSPACE_ID, userId: "u_2", tripDate: "2026-07-06", purpose: "Vendor meeting", distance: 9.2, distanceUnit: "mi", rateMinor: MILEAGE_RATE_MINOR, amountMinor: Math.round(9.2 * MILEAGE_RATE_MINOR), reimbursementStatus: "approved", rejectionReason: null },
  { id: "t_3", workspaceId: WORKSPACE_ID, userId: "u_4", tripDate: "2026-07-09", purpose: "Airport pickup", distance: 24.6, distanceUnit: "mi", rateMinor: MILEAGE_RATE_MINOR, amountMinor: Math.round(24.6 * MILEAGE_RATE_MINOR), reimbursementStatus: "pending", rejectionReason: null },
  { id: "t_4", workspaceId: WORKSPACE_ID, userId: "u_3", tripDate: "2026-07-13", purpose: "Supply run", distance: 6.1, distanceUnit: "mi", rateMinor: MILEAGE_RATE_MINOR, amountMinor: Math.round(6.1 * MILEAGE_RATE_MINOR), reimbursementStatus: "pending", rejectionReason: null },
  { id: "t_5", workspaceId: WORKSPACE_ID, userId: "u_4", tripDate: "2026-07-16", purpose: "Client site visit", distance: 18.4, distanceUnit: "mi", rateMinor: MILEAGE_RATE_MINOR, amountMinor: Math.round(18.4 * MILEAGE_RATE_MINOR), reimbursementStatus: "pending", rejectionReason: null },
];

const OUTSTANDING: ReimbursementStatus[] = ["pending", "approved"];
const inMonth = (iso: string, yyyyMm: string) => iso.startsWith(yyyyMm);

/** Members see only their own receipts; admins see the workspace. Mirrors RLS. */
function visibleReceipts(): Receipt[] {
  if (CURRENT_USER.role === "owner" || CURRENT_USER.role === "admin") return RECEIPTS;
  return RECEIPTS.filter((r) => r.createdBy === CURRENT_USER.id);
}

export function listReceipts(opts: { month?: string; categoryName?: string; userId?: string; q?: string } = {}): Receipt[] {
  return visibleReceipts()
    .filter((r) => (opts.month ? inMonth(r.receiptDate ?? "", opts.month) : true))
    .filter((r) => (opts.categoryName && opts.categoryName !== "All" ? r.categoryName === opts.categoryName : true))
    .filter((r) => (opts.userId && opts.userId !== "All" ? r.createdBy === opts.userId : true))
    .filter((r) => (opts.q ? (r.vendor ?? "").toLowerCase().includes(opts.q.toLowerCase()) : true))
    .sort((a, b) => (b.receiptDate ?? "").localeCompare(a.receiptDate ?? ""));
}

export function getReceipt(id: string): Receipt | undefined {
  return visibleReceipts().find((r) => r.id === id);
}

export function setReimbursementStatus(id: string, status: ReimbursementStatus, reason?: string): void {
  const r = RECEIPTS.find((x) => x.id === id);
  if (!r) return;
  r.reimbursementStatus = status;
  r.rejectionReason = status === "rejected" ? (reason ?? null) : null;
}

export function setCategory(id: string, categoryName: string): void {
  const r = RECEIPTS.find((x) => x.id === id);
  if (r) r.categoryName = categoryName;
}

function categoryBreakdown(receipts: Receipt[]): CategoryBreakdownRow[] {
  const total = receipts.reduce((s, r) => s + r.totalMinor, 0) || 1;
  const byName = new Map<string, number>();
  for (const r of receipts) {
    const key = r.categoryName ?? "Other";
    byName.set(key, (byName.get(key) ?? 0) + r.totalMinor);
  }
  return [...byName.entries()]
    .map(([name, amountMinor]) => ({
      categoryId: `cat_${name.toLowerCase().replace(/\s+/g, "_")}`,
      name,
      hue: derivedHue(name),
      amountMinor,
      pct: (amountMinor / total) * 100,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function getDashboard(month = "2026-07"): DashboardResponse {
  const all = visibleReceipts();
  const monthReceipts = all.filter((r) => inMonth(r.receiptDate ?? "", month));
  const prevReceipts = all.filter((r) => inMonth(r.receiptDate ?? "", "2026-06"));
  const ytd = all.filter((r) => (r.receiptDate ?? "").startsWith("2026"));

  const monthTotal = monthReceipts.reduce((s, r) => s + r.totalMinor, 0);
  const prevTotal = prevReceipts.reduce((s, r) => s + r.totalMinor, 0);
  const deltaPct = prevTotal ? ((monthTotal - prevTotal) / prevTotal) * 100 : 0;

  const outstanding = monthReceipts.filter((r) => OUTSTANDING.includes(r.reimbursementStatus));
  const reimbursableMinor = outstanding.reduce((s, r) => s + r.totalMinor, 0);
  const needsReviewCount = monthReceipts.filter((r) => r.status === "needs_review").length;
  const breakdown = categoryBreakdown(monthReceipts);

  const weeklySpend: { weekStart: string; totalMinor: number }[] = [];
  const end = new Date(`${TODAY}T00:00:00`);
  for (let i = 5; i >= 0; i--) {
    const weekEnd = new Date(end);
    weekEnd.setDate(end.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    const totalMinor = all
      .filter((r) => {
        const d = new Date(`${r.receiptDate}T00:00:00`);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((s, r) => s + r.totalMinor, 0);
    weeklySpend.push({ weekStart: weekStart.toISOString().slice(0, 10), totalMinor });
  }

  const health = computeHealth({
    deltaPct,
    monthTotalMinor: monthTotal,
    reimbursableMinor,
    categoryBreakdown: breakdown,
    receiptCount: monthReceipts.length,
    needsReviewCount,
  });

  return {
    currency: HOME_CURRENCY,
    stats: {
      monthTotalMinor: monthTotal,
      monthDeltaPct: deltaPct,
      ytdTotalMinor: ytd.reduce((s, r) => s + r.totalMinor, 0),
      ytdCount: ytd.length,
      taxMinor: monthReceipts.reduce((s, r) => s + (r.taxMinor ?? 0), 0),
      reimbursableMinor,
      reimbursablePendingCount: outstanding.length,
      receiptCount: monthReceipts.length,
      needsReviewCount,
    },
    weeklySpend,
    categoryBreakdown: breakdown,
    health,
    tips: [
      { iconLetter: "$", tone: "positive", text: "You're paying for Adobe and Zoom (€227.73 this month) — review for overlapping tools before renewal." },
      { iconLetter: "%", tone: "neutral", text: "Tax season prep: keep setting aside 10–15% of net income for deductible business expenses like these." },
      { iconLetter: "!", tone: "warn", text: `${outstanding.length} receipts are still awaiting payout. Clearing them improves your health score.` },
    ],
    recentReceipts: listReceipts().slice(0, 5),
  };
}

export function getTeam(month = "2026-07"): TeamResponse {
  const monthReceipts = RECEIPTS.filter((r) => inMonth(r.receiptDate ?? "", month));
  const allOutstanding = RECEIPTS.filter((r) => OUTSTANDING.includes(r.reimbursementStatus));
  const tripsOutstanding = TRIPS.filter((t) => OUTSTANDING.includes(t.reimbursementStatus));
  const mileageOutstandingMinor = tripsOutstanding.reduce((s, t) => s + t.amountMinor, 0);

  const members: TeamMemberSummary[] = USERS.map((u) => {
    const mine = RECEIPTS.filter((r) => r.createdBy === u.id);
    const outstanding = mine.filter((r) => OUTSTANDING.includes(r.reimbursementStatus));
    const ages = outstanding.map((r) => daysBetween(r.receiptDate ?? TODAY, TODAY));
    const byCat = new Map<string, number>();
    for (const r of mine) byCat.set(r.categoryName ?? "Other", (byCat.get(r.categoryName ?? "Other") ?? 0) + r.totalMinor);
    const topCategory = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      userId: u.id,
      name: u.name,
      jobTitle: u.jobTitle,
      role: u.role,
      receiptCount: mine.length,
      outstandingMinor: outstanding.reduce((s, r) => s + r.totalMinor, 0),
      oldestPendingDays: ages.length ? Math.max(...ages) : null,
      topCategory,
    };
  }).sort((a, b) => b.outstandingMinor - a.outstandingMinor);

  const agedOver30 = allOutstanding.filter((r) => daysBetween(r.receiptDate ?? TODAY, TODAY) > 30);

  return {
    currency: HOME_CURRENCY,
    outstandingRefundMinor: allOutstanding.reduce((s, r) => s + r.totalMinor, 0) + mileageOutstandingMinor,
    outstandingRefundCount: allOutstanding.length + tripsOutstanding.length,
    agedOver30Minor: agedOver30.reduce((s, r) => s + r.totalMinor, 0),
    agedOver30Count: agedOver30.length,
    teamTotalMinor: monthReceipts.reduce((s, r) => s + r.totalMinor, 0),
    userCount: USERS.length,
    needsReviewCount: monthReceipts.filter((r) => r.status === "needs_review").length,
    topSpenderName: members[0]?.name ?? null,
    members,
    mileage: [...TRIPS].sort((a, b) => b.tripDate.localeCompare(a.tripDate)),
    mileageRateMinor: MILEAGE_RATE_MINOR,
    mileageOutstandingMinor,
  };
}

export function listMileage(userId?: string): MileageTrip[] {
  const scoped =
    CURRENT_USER.role === "member"
      ? TRIPS.filter((t) => t.userId === CURRENT_USER.id)
      : TRIPS;
  return scoped
    .filter((t) => (userId && userId !== "All" ? t.userId === userId : true))
    .sort((a, b) => b.tripDate.localeCompare(a.tripDate));
}

export function addMileageTrip(input: { tripDate: string; purpose: string; distance: number; distanceUnit: "mi" | "km" }): MileageTrip {
  const trip: MileageTrip = {
    id: `t_${TRIPS.length + 1}`,
    workspaceId: WORKSPACE_ID,
    userId: CURRENT_USER.id,
    tripDate: input.tripDate,
    purpose: input.purpose,
    distance: input.distance,
    distanceUnit: input.distanceUnit,
    rateMinor: MILEAGE_RATE_MINOR,
    amountMinor: Math.round(input.distance * MILEAGE_RATE_MINOR),
    reimbursementStatus: "pending",
    rejectionReason: null,
  };
  TRIPS.push(trip);
  return trip;
}

export function listCategories(): string[] {
  return [...SEED_CATEGORIES];
}

export function userName(id: string): string {
  return USERS.find((u) => u.id === id)?.name ?? "Unknown";
}
