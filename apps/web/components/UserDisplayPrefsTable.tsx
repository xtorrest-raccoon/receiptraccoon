"use client";

import { useEffect, useState } from "react";
import type { WorkspaceUser } from "@rr/api";
import { currencySymbol, rateToDecimalString, parseRateToMilli, type DistanceUnit } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { CURRENCIES } from "../lib/data";
import { useSetUserDisplayCurrency, useSetUserDisplayDistanceUnit, useSetUserMileageRate } from "../lib/queries";
import { Avatar } from "./Avatar";

const WORKSPACE_DEFAULT = "";
const controlStyle = {
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.sm,
  padding: "6px 8px",
  fontSize: fontSize.small,
  fontWeight: fontWeight.semibold,
  background: color.surface,
  color: color.text,
};

function UserPrefsRow({
  user,
  workspaceCurrency,
  workspaceUnit,
  workspaceRateMilli,
}: {
  user: WorkspaceUser;
  workspaceCurrency: string;
  workspaceUnit: DistanceUnit;
  workspaceRateMilli: number;
}) {
  const setDisplayCurrency = useSetUserDisplayCurrency();
  const setDisplayDistanceUnit = useSetUserDisplayDistanceUnit();
  const setMileageRate = useSetUserMileageRate();

  const [rateText, setRateText] = useState(user.mileageRateMilli !== null ? rateToDecimalString(user.mileageRateMilli) : "");

  useEffect(() => {
    setRateText(user.mileageRateMilli !== null ? rateToDecimalString(user.mileageRateMilli) : "");
  }, [user.mileageRateMilli]);

  const commitRate = () => {
    if (rateText.trim() === "") {
      if (user.mileageRateMilli !== null) setMileageRate.mutate({ userId: user.id, rateMilli: null });
      return;
    }
    const parsed = parseRateToMilli(rateText);
    if (parsed !== null && parsed > 0 && parsed !== user.mileageRateMilli) {
      setMileageRate.mutate({ userId: user.id, rateMilli: parsed });
    } else {
      setRateText(user.mileageRateMilli !== null ? rateToDecimalString(user.mileageRateMilli) : "");
    }
  };

  // Matches getEffectiveMileageRateInfo's own precedence exactly: only a
  // rate actually typed for this row is denominated in that row's own
  // Currency/Distance unit -- the workspace-wide default (shown via the
  // placeholder below, while this field is empty) is one number defined
  // once, in the workspace's own currency/unit, regardless of this row's
  // personal display preference. Keyed off the live text, not just the
  // already-saved value, so the prefix/suffix already reflect what a
  // rate being typed right now will resolve to once it commits, not what
  // was true before this edit started.
  const hasRate = rateText.trim() !== "";
  const rateCurrency = hasRate ? user.displayCurrency ?? workspaceCurrency : workspaceCurrency;
  const rateUnit = hasRate ? user.displayDistanceUnit ?? workspaceUnit : workspaceUnit;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 1.3fr 1.1fr 1.3fr",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: `1px solid ${color.borderSubtle}`,
        fontSize: fontSize.body,
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={user.name} />
        <div style={{ fontWeight: fontWeight.bold }}>{user.name}</div>
      </div>

      <select
        value={user.displayCurrency ?? WORKSPACE_DEFAULT}
        onChange={(e) => setDisplayCurrency.mutate({ userId: user.id, code: e.target.value === WORKSPACE_DEFAULT ? null : e.target.value })}
        style={controlStyle}
      >
        <option value={WORKSPACE_DEFAULT}>Default ({workspaceCurrency})</option>
        {CURRENCIES.map((cur) => (
          <option key={cur} value={cur}>
            {cur}
          </option>
        ))}
      </select>

      <select
        value={user.displayDistanceUnit ?? WORKSPACE_DEFAULT}
        onChange={(e) =>
          setDisplayDistanceUnit.mutate({ userId: user.id, unit: e.target.value === WORKSPACE_DEFAULT ? null : (e.target.value as DistanceUnit) })
        }
        style={controlStyle}
      >
        <option value={WORKSPACE_DEFAULT}>Default ({workspaceUnit})</option>
        <option value="mi">mi</option>
        <option value="km">km</option>
      </select>

      {/* Currency and unit sit right on the field itself, not just in the
          column header or a placeholder that disappears once you type --
          this is the one row-specific fact that's easy to misread once
          there's an adjacent, differently-valued Currency dropdown. Both
          the prefix and suffix follow THIS row's own effective values (its
          override, or the workspace default) -- changing the Distance unit
          dropdown to the left auto-converts a rate already typed here to
          the equivalent figure in the new unit (see setUserDisplayDistanceUnit),
          so this suffix and the number it's attached to never drift apart. */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          border: `1px solid ${color.borderStrong}`,
          borderRadius: radius.sm,
          overflow: "hidden",
          background: color.surface,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 7px",
            fontSize: fontSize.small,
            fontWeight: fontWeight.bold,
            color: color.textMuted,
            background: color.surfaceMuted,
            borderRight: `1px solid ${color.borderStrong}`,
          }}
        >
          {currencySymbol(rateCurrency)}
        </span>
        <input
          value={rateText}
          onChange={(e) => setRateText(e.target.value)}
          onBlur={commitRate}
          placeholder={`Default (${rateToDecimalString(workspaceRateMilli)})`}
          style={{ ...controlStyle, flex: 1, minWidth: 0, border: "none", borderRadius: 0 }}
        />
        <span
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 7px",
            fontSize: fontSize.small,
            fontWeight: fontWeight.bold,
            color: color.textMuted,
            background: color.surfaceMuted,
            borderLeft: `1px solid ${color.borderStrong}`,
          }}
        >
          /{rateUnit}
        </span>
      </div>
    </div>
  );
}

/**
 * Per-user overrides an admin sets on someone else's behalf: display
 * currency and distance unit (see 0019/0020_*.sql -- display-only, never
 * changes what's stored or reimbursed) and mileage rate (0013_per_user_mileage_rate.sql
 * -- this one DOES change what's paid, a real payroll decision). Distinct
 * from the Profile page, where a user sets their own currency/unit for
 * themselves; an admin's edit here simply overwrites that same value.
 */
export function UserDisplayPrefsTable({
  users,
  workspaceCurrency,
  workspaceUnit,
  workspaceRateMilli,
}: {
  users: WorkspaceUser[];
  workspaceCurrency: string;
  workspaceUnit: DistanceUnit;
  workspaceRateMilli: number;
}) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], marginTop: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>User currency &amp; mileage setup</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Per-person overrides. User Currency and Distance unit change how amounts/distances show up for that person
          (mobile and their own web views) — but they also decide what currency and unit a Mileage rate typed for
          that person is in, shown right on the field itself. Changing Distance unit auto-converts a rate already
          typed here to the equivalent figure in the new unit. The saved trip still gets converted to the workspace's
          own currency for Team totals and payroll.
        </div>
      </div>

      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1.6fr 1.3fr 1.1fr 1.3fr",
          padding: "10px 20px",
          fontSize: fontSize.tiny + 0.5,
          fontWeight: fontWeight.bold,
          color: color.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          borderBottom: `1px solid ${color.borderSubtle}`,
        }}
      >
        <div>User</div>
        <div>User Currency</div>
        <div>Distance unit</div>
        <div>Mileage rate</div>
      </div>

      {users.map((u) => (
        <UserPrefsRow key={u.id} user={u} workspaceCurrency={workspaceCurrency} workspaceUnit={workspaceUnit} workspaceRateMilli={workspaceRateMilli} />
      ))}
    </div>
  );
}
