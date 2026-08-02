"use client";

import { currencySymbol, rateToDecimalString } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import {
  useCurrentUser,
  useHomeCurrency,
  useDistanceUnit,
  useHomeWorkspaceName,
  useIsHomeWorkspace,
  useMyDisplayPrefs,
  useMyMileageRateMilli,
} from "../../lib/queries";

function InfoCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, minWidth: 220, flex: "0 0 auto" }}>
      <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: fontSize.small + 1, fontWeight: fontWeight.bold, color: color.text }}>{value}</div>
      <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>{hint}</div>
    </div>
  );
}

/**
 * Read-only — display currency, distance unit, and mileage rate are all set
 * for you by an admin now (see Setup's "User currency & mileage" table),
 * not something you edit yourself. This page exists purely so you can see
 * what's currently configured, same reasoning as mobile's Settings sheet.
 */
export default function ProfilePage() {
  const { data: currentUser } = useCurrentUser();
  const { data: isHome } = useIsHomeWorkspace();
  const { data: homeWorkspaceName } = useHomeWorkspaceName();
  const { data: workspaceCurrency } = useHomeCurrency();
  const { data: workspaceUnit } = useDistanceUnit();
  const { data: prefs } = useMyDisplayPrefs();
  const { data: rateMilli } = useMyMileageRateMilli();

  if (!currentUser || isHome === undefined) return null;

  if (!isHome) {
    return (
      <div>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Profile</div>
        <div
          style={{
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius["2xl"],
            padding: 20,
            maxWidth: 480,
            fontSize: fontSize.body,
            color: color.textMuted,
            lineHeight: 1.6,
          }}
        >
          You only administer this workspace — it's not where your own receipts and mileage live, so there's nothing
          personal to show here.{" "}
          {homeWorkspaceName ? (
            <>
              Switch to <strong style={{ color: color.text }}>{homeWorkspaceName}</strong> to see your own display
              currency, distance unit, and mileage rate.
            </>
          ) : (
            "Switch to your own workspace to see your display currency, distance unit, and mileage rate."
          )}
        </div>
      </div>
    );
  }

  if (!workspaceCurrency || !workspaceUnit || !prefs || rateMilli === undefined) return null;

  const currency = prefs.currency ?? workspaceCurrency;
  const unit = prefs.distanceUnit ?? workspaceUnit;

  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Profile</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        How amounts and distances show up for you, {currentUser.name} — set by your admin from Setup, not something
        you edit yourself.
      </div>

      <div className="flex flex-wrap" style={{ gap: 16 }}>
        <InfoCard
          label="Display currency"
          value={prefs.currency ? currency : `${currency} (workspace default)`}
          hint="Amounts on your Home, Receipts, and Mileage screens show in this currency. Everything is still stored and reimbursed in the workspace's own currency."
        />
        <InfoCard
          label="Display distance unit"
          value={prefs.distanceUnit ? unit : `${unit} (workspace default)`}
          hint="Already-logged trips display in this unit. New trips are always logged in the workspace's own unit."
        />
        <InfoCard
          label="Your mileage rate"
          value={`${currencySymbol(workspaceCurrency)}${rateToDecimalString(rateMilli)} per ${workspaceUnit}`}
          hint="What your trips are actually reimbursed at — either your own rate, or the workspace default. Always in the workspace's own currency and unit, not your display currency above."
        />
      </div>
    </div>
  );
}
