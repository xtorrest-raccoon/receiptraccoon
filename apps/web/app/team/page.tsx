"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { canViewTeamPage, convertReceiptCurrency, formatMoney, isAdmin, isOutstanding, reclaimMinor, type Receipt, type ReimbursementStatus } from "@rr/shared";
import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import { useCategories, useCurrentUser, useFxRatesTo, useMileage, useReceipts, useTeam, useUsers } from "../../lib/queries";
import { exportReceiptsCsv } from "../../lib/receiptsCsv";
import { StatCard } from "../../components/StatCard";
import { TeamMembersTable } from "../../components/TeamMembersTable";
import { MileageTable } from "../../components/MileageTable";
import { ReceiptsTable } from "../../components/ReceiptsTable";
import { MultiSelectDropdown, multiSelectControlStyle } from "../../components/MultiSelectDropdown";
import { ExportCsvDateRangeModal } from "../../components/ExportCsvDateRangeModal";
import { DownloadIcon } from "../../components/icons";

const STATUS_OPTIONS: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];
// Rejected/reimbursed are settled — default to what still needs action.
const DEFAULT_STATUS_FILTER: ReimbursementStatus[] = ["pending", "approved"];
const filterSelectStyle = { ...multiSelectControlStyle, width: 170, padding: "7px 10px", fontSize: fontSize.small, fontWeight: fontWeight.semibold };

/** Translucent red-on-dark panel, mixed from the `up` (bad-trend) token — there
 * is no dedicated "alert on dark" entry in @rr/ui-tokens. */
const AGED_ALERT_BG = `color-mix(in oklch, ${color.up} 28%, transparent)`;

export default function TeamPage() {
  const { data: currentUser } = useCurrentUser();
  const allowed = currentUser ? canViewTeamPage(currentUser.role, currentUser) : false;
  // Full page (member list, invites, workspace-wide totals) stays admin/owner-only —
  // someone granted only approve/process authority gets a trimmed view: just the
  // reimbursement queues they can act on.
  const admin = currentUser ? isAdmin(currentUser.role) : false;

  const [mileageUserFilter, setMileageUserFilter] = useState("All");
  const [mileageStatusFilter, setMileageStatusFilter] = useState<ReimbursementStatus[]>(DEFAULT_STATUS_FILTER);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptCategoryFilter, setReceiptCategoryFilter] = useState("All");
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<ReimbursementStatus[]>(DEFAULT_STATUS_FILTER);
  const [receiptUserFilter, setReceiptUserFilter] = useState("All");
  const [exporting, setExporting] = useState(false);

  const { data: team } = useTeam();
  const { data: users } = useUsers();
  const { data: categories } = useCategories();
  const { data: mileage } = useMileage(mileageUserFilter === "All" ? undefined : mileageUserFilter);
  const { data: receipts } = useReceipts({
    q: receiptSearch || undefined,
    categoryName: receiptCategoryFilter,
    userId: receiptUserFilter === "All" ? undefined : receiptUserFilter,
  });
  // Deliberately unfiltered (no search/category/user) -- exporting asks for
  // a date range instead (see ExportCsvDateRangeModal) and always includes
  // every status and every person within it, independent of whatever's
  // shown on screen.
  const { data: allForExport } = useReceipts({});

  const mileageOutstandingMinor = useMemo(() => {
    return (mileage ?? []).filter((t) => isOutstanding(t.reimbursementStatus)).reduce((sum, t) => sum + t.amountMinor, 0);
  }, [mileage]);

  // Team is the one company-wide comparison view -- every receipt shows in
  // the workspace's OWN currency here, never a personal preference. A
  // receipt captured before the workspace's currency was last changed still
  // carries its original currency (never retroactively reconverted -- see
  // Setup's Currency card), so this resolves whatever distinct currencies
  // are actually present against the current workspace currency.
  const fxRates = useFxRatesTo((receipts ?? []).map((r) => r.currency), team?.currency);
  const receiptsInWorkspaceCurrency: Receipt[] = useMemo(() => {
    if (!team) return receipts ?? [];
    return (receipts ?? []).map((r) => {
      if (r.currency === team.currency) return r;
      const rate = fxRates[r.currency];
      return rate != null ? convertReceiptCurrency(r, team.currency, rate) : r;
    });
  }, [receipts, team, fxRates]);

  // Same "pending refund" figure, for receipts — independent of the status
  // filter below (same reasoning as mileageOutstandingMinor), so toggling
  // which rows show doesn't change what's actually still owed.
  const receiptsOutstandingMinor = useMemo(() => {
    return receiptsInWorkspaceCurrency.filter((r) => isOutstanding(r.reimbursementStatus)).reduce((sum, r) => sum + reclaimMinor(r), 0);
  }, [receiptsInWorkspaceCurrency]);

  // Status filter narrows the table only — the outstanding total above stays
  // computed from the full unfiltered list, same "filter is display-only"
  // pattern as receiptStatusFilter.
  const filteredMileage = (mileage ?? []).filter((t) => mileageStatusFilter.includes(t.reimbursementStatus));

  // Client-side, same reasoning as categoryName in @rr/api's listReceipts.
  const filteredReceipts = receiptsInWorkspaceCurrency.filter((r) => receiptStatusFilter.includes(r.reimbursementStatus));

  // Same workspace-currency conversion as receiptsInWorkspaceCurrency above,
  // just against the unfiltered export set rather than the on-screen one.
  const exportFxRates = useFxRatesTo((allForExport ?? []).map((r) => r.currency), team?.currency);
  const exportInRange = (startDate: string, endDate: string) => {
    const inWorkspaceCurrency = (allForExport ?? []).map((r) => {
      if (!team || r.currency === team.currency) return r;
      const rate = exportFxRates[r.currency];
      return rate != null ? convertReceiptCurrency(r, team.currency, rate) : r;
    });
    const inRange = inWorkspaceCurrency.filter((r) => r.receiptDate && r.receiptDate >= startDate && r.receiptDate <= endDate);
    exportReceiptsCsv(inRange, users ?? [], "receiptraccoon-team-receipts.csv");
    setExporting(false);
  };

  if (!currentUser || !allowed) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, marginBottom: 8 }}>403 — Not authorized</div>
        <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          The Team page is only visible to workspace owners and admins.
          {currentUser ? ` Signed in as ${currentUser.name} (${currentUser.role}).` : ""}
        </div>
        <Link href="/dashboard" style={{ color: color.brand, fontWeight: fontWeight.bold, fontSize: fontSize.body }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!team || !users || !categories) return null;

  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>
        {admin ? "Team spend" : "Reimbursement queue"}
      </div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        {admin
          ? "Expense situation across everyone on the account this month."
          : "Receipts and mileage trips you have authority to approve, reject, or refund."}
      </div>

      {admin ? (
        <>
          <div
            className="flex-col sm:flex-row"
            style={{
              background: color.inkPanel,
              borderRadius: radius["2xl"],
              padding: "20px 24px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: fontSize.small, color: color.inkPanelText, fontWeight: fontWeight.semibold }}>
                Outstanding refund — all pending &amp; approved receipts, any month
              </div>
              <div style={{ fontSize: fontSize.stat, fontWeight: fontWeight.heavy, color: color.surface, marginTop: 8 }}>
                {formatMoney(team.outstandingRefundMinor, team.currency)}
              </div>
              <div style={{ fontSize: fontSize.small, color: color.inkPanelText, marginTop: 4 }}>
                Across {team.outstandingRefundCount} receipts
              </div>
            </div>
            {team.agedOver30Count > 0 ? (
              <div style={{ background: AGED_ALERT_BG, borderRadius: radius.lg, padding: "14px 18px" }}>
                <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.up }}>Over 30 days old</div>
                <div style={{ fontSize: fontSize.h2 - 1, fontWeight: fontWeight.heavy, color: color.surface, marginTop: 4 }}>
                  {formatMoney(team.agedOver30Minor, team.currency)}
                </div>
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.up, marginTop: 2 }}>{team.agedOver30Count} receipts need attention</div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" style={{ marginBottom: 18 }}>
            <StatCard label="Team spend this month (receipts)" value={formatMoney(team.teamTotalMinor, team.currency)} valueSize={fontSize.stat - 2} />
            <StatCard label="Team mileage cost this month" value={formatMoney(team.teamMileageTotalMinor, team.currency)} valueSize={fontSize.stat - 2} />
            <StatCard label="Active users" value={team.userCount} valueSize={fontSize.stat - 2} />
            <StatCard label="Pending review" value={team.needsReviewCount} valueSize={fontSize.stat - 2} />
            <StatCard label="Highest spender" value={team.topSpenderName ?? "—"} valueSize={fontSize.h3} />
          </div>

          <TeamMembersTable members={team.members} currency={team.currency} />
        </>
      ) : null}

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden", marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${color.borderSubtle}`,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Receipts</div>
            <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>Uploaded from the mobile or web app</div>
          </div>
          <div className="flex flex-wrap" style={{ alignItems: "center", gap: 10 }}>
            <input
              placeholder="Search by vendor…"
              value={receiptSearch}
              onChange={(e) => setReceiptSearch(e.target.value)}
              style={{
                minWidth: 160,
                maxWidth: 200,
                padding: "7px 10px",
                borderRadius: radius.sm + 1,
                border: `1px solid ${color.borderStrong}`,
                fontSize: fontSize.small,
                background: color.surface,
              }}
            />
            <select
              value={receiptCategoryFilter}
              onChange={(e) => setReceiptCategoryFilter(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: radius.sm + 1,
                border: `1px solid ${color.borderStrong}`,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                background: color.surface,
                color: color.text,
              }}
            >
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <MultiSelectDropdown
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: reimbursementChip[s].label }))}
              selected={receiptStatusFilter}
              onChange={(next) => setReceiptStatusFilter(next as ReimbursementStatus[])}
              emptyLabel="No statuses selected"
              buttonStyle={filterSelectStyle}
            />
            <select
              value={receiptUserFilter}
              onChange={(e) => setReceiptUserFilter(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: radius.sm + 1,
                border: `1px solid ${color.borderStrong}`,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                background: color.surface,
                color: color.text,
              }}
            >
              <option value="All">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setExporting(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: radius.sm + 1,
                background: color.brand,
                color: color.surface,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.small,
                border: "none",
                cursor: "pointer",
              }}
            >
              <DownloadIcon color={color.surface} />
              Export CSV
            </button>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy }}>{formatMoney(receiptsOutstandingMinor, team.currency)}</div>
          </div>
        </div>
        <ReceiptsTable receipts={filteredReceipts} categories={categories} users={users} />
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden", marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${color.borderSubtle}`,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Mileage reimbursements</div>
            <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
              {/* No single rate shown here anymore — each person can have their
                  own (see Setup's Mileage rates), so the table's own Rate
                  column is the accurate per-trip figure, not this subtitle. */}
              Logged from the mobile app · rate varies per person, see each row
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <select
              value={mileageUserFilter}
              onChange={(e) => setMileageUserFilter(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: radius.sm + 1,
                border: `1px solid ${color.borderStrong}`,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                background: color.surface,
                color: color.text,
              }}
            >
              <option value="All">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <MultiSelectDropdown
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: reimbursementChip[s].label }))}
              selected={mileageStatusFilter}
              onChange={(next) => setMileageStatusFilter(next as ReimbursementStatus[])}
              emptyLabel="No statuses selected"
              buttonStyle={filterSelectStyle}
            />
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy }}>{formatMoney(mileageOutstandingMinor, team.currency)}</div>
          </div>
        </div>

        <MileageTable
          trips={filteredMileage}
          currency={team.currency}
          users={users}
        />
      </div>

      {exporting ? <ExportCsvDateRangeModal onCancel={() => setExporting(false)} onConfirm={exportInRange} /> : null}
    </div>
  );
}
