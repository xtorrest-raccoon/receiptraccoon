"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  canManageReimbursementAuthority,
  currencySymbol,
  rateToDecimalString,
  parseRateToMilli,
  MI_TO_KM,
  type DistanceUnit,
} from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { CURRENCIES } from "../../lib/data";
import {
  useCategories,
  useCurrentUser,
  useDistanceUnit,
  useHomeCurrency,
  useMileageRateMilli,
  useSetDistanceUnit,
  useSetHomeCurrency,
  useSetMileageRateMilli,
  useUsers,
} from "../../lib/queries";
import { ProvisionMemberPanel } from "../../components/ProvisionMemberPanel";
import { ReimbursementAuthorityTable } from "../../components/ReimbursementAuthorityTable";
import { UserDisplayPrefsTable } from "../../components/UserDisplayPrefsTable";
import { ManageCategoriesPanel } from "../../components/ManageCategoriesPanel";
import { NotificationsPanel } from "../../components/NotificationsPanel";
import { PaymentSetupPanel } from "../../components/PaymentSetupPanel";
import { InvoiceList } from "../../components/InvoiceList";

/**
 * Distance unit + reimbursement rate, workspace-wide -- editing lives only
 * here now (see mobile's Settings sheet, which shows these read-only). Rate
 * is held as a local draft so typing doesn't fire a mutation per keystroke;
 * it commits on blur. Switching unit converts the current draft immediately
 * (same reasoning as mobile's SettingsSheet) so the figure stays worth
 * roughly the same rather than reading 1.6x wrong until someone notices.
 */
function MileageSettingsCard({ unit, rateMilli }: { unit: DistanceUnit; rateMilli: number }) {
  const setDistanceUnit = useSetDistanceUnit();
  const setMileageRateMilli = useSetMileageRateMilli();
  const { data: homeCurrency } = useHomeCurrency();
  const [rateText, setRateText] = useState(rateToDecimalString(rateMilli));

  useEffect(() => {
    setRateText(rateToDecimalString(rateMilli));
  }, [rateMilli]);

  const changeUnit = (next: DistanceUnit) => {
    if (next === unit) return;
    const current = parseRateToMilli(rateText);
    setDistanceUnit.mutate(next);
    if (current !== null) {
      const converted = Math.round(next === "km" ? current / MI_TO_KM : current * MI_TO_KM);
      setRateText(rateToDecimalString(converted));
    }
  };

  const parsedRate = parseRateToMilli(rateText);
  const rateValid = parsedRate !== null && parsedRate > 0;

  const commitRate = () => {
    if (rateValid && parsedRate !== rateMilli) setMileageRateMilli.mutate(parsedRate);
    else setRateText(rateToDecimalString(rateMilli));
  };

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, minWidth: 240, flex: "0 0 auto" }}>
      <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
        Distance unit
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["mi", "km"] as const).map((u) => {
          const on = u === unit;
          return (
            <button
              key={u}
              type="button"
              onClick={() => changeUnit(u)}
              style={{
                padding: "6px 14px",
                borderRadius: radius.pill,
                border: `1px solid ${on ? color.brand : color.borderStrong}`,
                background: on ? color.brand : color.surface,
                color: on ? "#fff" : color.textMuted,
                fontSize: fontSize.small,
                fontWeight: fontWeight.bold,
                cursor: "pointer",
              }}
            >
              {u}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
        Reimbursement rate per {unit}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: fontSize.small + 0.5, fontWeight: fontWeight.bold, color: color.textMuted }}>
          {currencySymbol(homeCurrency ?? "EUR")}
        </span>
        <input
          value={rateText}
          onChange={(e) => setRateText(e.target.value)}
          onBlur={commitRate}
          placeholder="0.700"
          style={{
            flex: 1,
            border: `1px solid ${rateValid ? color.borderStrong : color.up}`,
            borderRadius: radius.sm,
            padding: "7px 10px",
            fontSize: fontSize.small + 0.5,
            fontWeight: fontWeight.semibold,
            background: color.surface,
            color: color.text,
          }}
        />
      </div>
      {!rateValid && (
        <div style={{ fontSize: fontSize.micro + 0.5, color: color.up, marginTop: 6 }}>Enter a rate above zero.</div>
      )}
      <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>
        Applies to new trips. Trips already logged keep the rate they were recorded at.
      </div>
    </div>
  );
}

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
  const setHomeCurrency = useSetHomeCurrency();
  const { data: distanceUnit } = useDistanceUnit();
  const { data: mileageRateMilli } = useMileageRateMilli();

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

  if (!users || !categories || !homeCurrency || !distanceUnit || mileageRateMilli === undefined) return null;

  const canManageBilling = currentUser.role === "owner" || currentUser.role === "admin";

  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Setup</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        How this workspace is configured — accounts, invites, and who can approve or refund what.
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, minWidth: 180, maxWidth: 220 }}>
        <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
          Active seats
        </div>
        <div style={{ fontSize: fontSize.stat - 4, fontWeight: fontWeight.heavy }}>{users.length}</div>
        <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>
          Everyone currently in this workspace.
        </div>
      </div>

      <SectionHeading>Currency &amp; mileage</SectionHeading>
      <div style={{ fontSize: fontSize.small, color: color.textFaint, marginTop: -6, marginBottom: 10 }}>
        Workspace-wide — the mobile app shows these read-only; edits only happen here.
      </div>
      <div className="flex flex-wrap" style={{ gap: 16 }}>
        <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, minWidth: 220, flex: "0 0 auto" }}>
          <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
            Workspace currency
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

        <MileageSettingsCard unit={distanceUnit} rateMilli={mileageRateMilli} />
      </div>

      <UserDisplayPrefsTable
        users={users}
        workspaceCurrency={homeCurrency}
        workspaceUnit={distanceUnit}
        workspaceRateMilli={mileageRateMilli}
      />

      <SectionHeading>Account access</SectionHeading>
      <ProvisionMemberPanel />

      <SectionHeading>Approval hierarchy</SectionHeading>
      <ReimbursementAuthorityTable users={users} currentUser={currentUser} />

      <SectionHeading>Categories</SectionHeading>
      <ManageCategoriesPanel categories={categories} />

      <SectionHeading>Notifications</SectionHeading>
      <NotificationsPanel />

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
