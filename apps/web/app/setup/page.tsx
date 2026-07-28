"use client";

import Link from "next/link";
import { canManageReimbursementAuthority } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { CURRENCIES } from "../../lib/data";
import { useCategories, useCurrentUser, useDistanceUnit, useHomeCurrency, useMileageRateMilli, useSetHomeCurrency, useUsers } from "../../lib/queries";
import { ProvisionMemberPanel } from "../../components/ProvisionMemberPanel";
import { ReimbursementAuthorityTable } from "../../components/ReimbursementAuthorityTable";
import { ManageCategoriesPanel } from "../../components/ManageCategoriesPanel";
import { MileageRatesPanel } from "../../components/MileageRatesPanel";
import { PaymentSetupPanel } from "../../components/PaymentSetupPanel";
import { InvoiceList } from "../../components/InvoiceList";

function SectionHeading({ children }: { children: string }) {
  return (
    <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 28, marginBottom: 10 }}>
      {children}
    </div>
  );
}

/**
 * Everything about how this workspace is configured, in one place — account
 * creation, invites, the reimbursement approval hierarchy, and workspace-wide
 * settings. Visible only to whoever canManageReimbursementAuthority (admin/
 * owner, or a super user with both capabilities) — the same audience already
 * allowed to grant authority itself.
 */
export default function SetupPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: users } = useUsers();
  const { data: categories } = useCategories();
  const { data: homeCurrency } = useHomeCurrency();
  const { data: mileageRateMilli } = useMileageRateMilli();
  const { data: distanceUnit } = useDistanceUnit();
  const setHomeCurrency = useSetHomeCurrency();

  const allowed = currentUser ? canManageReimbursementAuthority(currentUser.role, currentUser) : false;

  if (!currentUser || !allowed) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, marginBottom: 8 }}>403 — Not authorized</div>
        <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          Setup is only visible to workspace owners/admins, or anyone granted full reimbursement authority.
          {currentUser ? ` Signed in as ${currentUser.name} (${currentUser.role}).` : ""}
        </div>
        <Link href="/dashboard" style={{ color: color.brand, fontWeight: fontWeight.bold, fontSize: fontSize.body }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!users || !categories || mileageRateMilli === undefined || !homeCurrency || !distanceUnit) return null;

  const canManageBilling = currentUser.role === "owner" || currentUser.role === "admin";

  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Setup</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        How this workspace is configured — accounts, invites, and who can approve or refund what.
      </div>

      <div className="flex flex-wrap" style={{ gap: 16 }}>
        <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, minWidth: 220, flex: "0 0 auto" }}>
          <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
            Home currency
          </div>
          <select
            value={homeCurrency ?? "EUR"}
            onChange={(e) => setHomeCurrency.mutate(e.target.value)}
            style={{
              width: "100%",
              border: `1px solid ${color.borderStrong}`,
              borderRadius: radius.sm,
              padding: "7px 10px",
              fontSize: fontSize.small + 0.5,
              fontWeight: fontWeight.semibold,
              background: color.surface,
              color: color.text,
            }}
          >
            {CURRENCIES.map((cur) => (
              <option key={cur} value={cur}>
                {cur}
              </option>
            ))}
          </select>
          <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>
            Foreign receipts are auto-converted at scan time using the latest rate.
          </div>
        </div>

        <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, minWidth: 180, flex: "0 0 auto" }}>
          <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
            Active seats
          </div>
          <div style={{ fontSize: fontSize.stat - 4, fontWeight: fontWeight.heavy }}>{users.length}</div>
          <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>
            Everyone currently in this workspace.
          </div>
        </div>
      </div>

      <SectionHeading>Account access</SectionHeading>
      <ProvisionMemberPanel />

      <SectionHeading>Approval hierarchy</SectionHeading>
      <ReimbursementAuthorityTable users={users} currentUser={currentUser} />

      <SectionHeading>Mileage rates</SectionHeading>
      <MileageRatesPanel users={users} workspaceRateMilli={mileageRateMilli} workspaceUnit={distanceUnit} currency={homeCurrency} />

      <SectionHeading>Categories</SectionHeading>
      <ManageCategoriesPanel categories={categories} />

      {canManageBilling ? (
        <>
          <SectionHeading>Payment setup</SectionHeading>
          <PaymentSetupPanel currentUser={currentUser} />

          <SectionHeading>Invoices</SectionHeading>
          <InvoiceList />
        </>
      ) : null}
    </div>
  );
}
