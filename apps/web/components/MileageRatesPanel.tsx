"use client";

import { useState } from "react";
import { currencySymbol, parseRateToMilli, rateToDecimalString, type DistanceUnit } from "@rr/shared";
import type { WorkspaceUser } from "@rr/api";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useSetUserMileageRate } from "../lib/queries";
import { Avatar } from "./Avatar";

/**
 * Owner/admin-only per-user mileage rate override — lets people in
 * different countries, with different reimbursement policies, be paid at
 * their own rate instead of one number for the whole workspace. A blank
 * field means "inherit the workspace default" (see 0013_per_user_mileage_rate.sql);
 * clearing the field back to empty and saving reverts to that default.
 */
export function MileageRatesPanel({
  users,
  workspaceRateMilli,
  workspaceUnit,
  currency,
}: {
  users: WorkspaceUser[];
  workspaceRateMilli: number;
  workspaceUnit: DistanceUnit;
  currency: string;
}) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], marginTop: 16, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Mileage rates</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>
          Per person, in case reimbursement policy varies by country — leave blank to use the workspace default (
          {currencySymbol(currency)}
          {rateToDecimalString(workspaceRateMilli)}/{workspaceUnit}
          ), same unit as Setup's home mileage setting.
        </div>
      </div>

      {users.map((u) => (
        <MileageRateRow key={u.id} user={u} currency={currency} unit={workspaceUnit} />
      ))}
    </div>
  );
}

function MileageRateRow({ user, currency, unit }: { user: WorkspaceUser; currency: string; unit: DistanceUnit }) {
  const setRate = useSetUserMileageRate();
  const [text, setText] = useState(user.mileageRateMilli !== null ? rateToDecimalString(user.mileageRateMilli) : "");

  const save = () => {
    const parsed = parseRateToMilli(text);
    setRate.mutate({ userId: user.id, rateMilli: parsed });
    if (parsed === null) setText("");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 20px",
        borderBottom: `1px solid ${color.borderSubtle}`,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={user.name} />
        <div style={{ fontWeight: fontWeight.bold, fontSize: fontSize.body }}>{user.name}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: fontSize.small, color: color.textFaint }}>{currencySymbol(currency)}</span>
        <input
          placeholder="Workspace default"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          style={{
            width: 130,
            padding: "7px 10px",
            borderRadius: radius.sm + 1,
            border: `1px solid ${color.borderStrong}`,
            fontSize: fontSize.small,
            background: color.surface,
            color: color.text,
          }}
        />
        <span style={{ fontSize: fontSize.small, color: color.textFaint }}>/{unit}</span>
      </div>
    </div>
  );
}
