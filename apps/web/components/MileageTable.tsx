"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  canTransitionReimbursement,
  currencySymbol,
  formatMoney,
  formatShortDate,
  hasAnyReimbursementAuthority,
  isAdmin,
  rateToDecimalString,
  type MileageTrip,
  type ReimbursementStatus,
} from "@rr/shared";
import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import type { WorkspaceUser } from "@rr/api";
import { useCurrentUser, useDeleteMileageTrip } from "../lib/queries";
import { useDataStore } from "../lib/store";
import { MileageTripDrawer } from "./MileageTripDrawer";
import { TrashIcon } from "./icons";

const STATUS_OPTIONS: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];

function nameOf(users: WorkspaceUser[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? "Unknown";
}

export function MileageTable({
  trips,
  currency,
  users,
}: {
  trips: MileageTrip[];
  currency: string;
  users: WorkspaceUser[];
}) {
  const { data: currentUser } = useCurrentUser();
  // Status changes only ever happen from Team, regardless of role/authority
  // — the Mileage tab (personal) always shows a read-only chip.
  const onTeamPage = usePathname().startsWith("/team");
  const canAct = onTeamPage && currentUser ? isAdmin(currentUser.role) || hasAnyReimbursementAuthority(currentUser) : false;
  const { requestReimbursementChange } = useDataStore();
  const deleteTrip = useDeleteMileageTrip();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null;

  // Own trip, still pending — the only status @rr/api's deleteMileageTrip
  // actually permits (unlike receipts, rejected mileage stays put).
  const canDelete = (t: MileageTrip) => currentUser?.id === t.userId && t.reimbursementStatus === "pending";

  const confirmDelete = (t: MileageTrip) => {
    if (!window.confirm(`Delete the trip "${t.purpose}"? This can't be undone.`)) return;
    deleteTrip.mutate(t.id);
  };

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden" }}>
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1fr 1.4fr 1.1fr 0.8fr 0.8fr 0.9fr 0.75fr",
          padding: "10px 20px",
          fontSize: fontSize.tiny,
          fontWeight: fontWeight.bold,
          color: color.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          borderBottom: `1px solid ${color.borderSubtle}`,
        }}
      >
        <div>Date</div>
        <div>User</div>
        <div>Purpose</div>
        <div>Distance</div>
        <div>Rate</div>
        <div>Amount</div>
        <div>Status</div>
      </div>

      {trips.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: color.textFaint, fontSize: fontSize.body }}>No mileage trips logged.</div>
      ) : (
        trips.map((t) => {
          const status = t.reimbursementStatus;
          return (
            <div key={t.id}>
              <div
                className="hidden sm:grid"
                style={{
                  gridTemplateColumns: "1fr 1.4fr 1.1fr 0.8fr 0.8fr 0.9fr 0.75fr",
                  alignItems: "center",
                  padding: "11px 20px",
                  borderBottom: `1px solid ${color.borderSubtle}`,
                  fontSize: fontSize.body,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTripId(t.id)}
                  style={{ cursor: "pointer", color: color.textMuted, background: "none", border: "none", textAlign: "left", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
                >
                  {formatShortDate(t.tripDate)}
                </button>
                <div style={{ fontWeight: fontWeight.semibold }}>{nameOf(users, t.userId)}</div>
                <button
                  type="button"
                  onClick={() => setSelectedTripId(t.id)}
                  style={{ cursor: "pointer", color: color.textStrong, background: "none", border: "none", textAlign: "left", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
                >
                  {t.purpose}
                </button>
                <div style={{ color: color.textMuted }}>
                  {t.distance.toFixed(1)} {t.distanceUnit}
                </div>
                {/* Frozen onto the trip at entry — this person's own rate at
                    the time, not today's workspace default or override. Per
                    rateUnit, which may differ from the trip's own distanceUnit.
                    In t.originalCurrency if the rate was set in a currency
                    other than the workspace's own (see
                    0034_mileage_rate_currency.sql) — `currency` (the prop,
                    always the workspace's own) is for the Amount column
                    below, which IS always in it; using it here too would
                    mislabel a rate that never got converted. */}
                <div style={{ color: color.textMuted, fontSize: fontSize.small }}>
                  {currencySymbol(t.originalCurrency ?? currency)}
                  {rateToDecimalString(t.rateMilli)}/{t.rateUnit}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTripId(t.id)}
                  style={{ cursor: "pointer", fontWeight: fontWeight.bold, background: "none", border: "none", textAlign: "left", padding: 0, color: color.text, fontFamily: "inherit", fontSize: "inherit" }}
                >
                  {formatMoney(t.amountMinor, currency)}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {canAct ? (
                    <select
                      value={status}
                      onChange={(e) =>
                        requestReimbursementChange(t.id, t.purpose, e.target.value as ReimbursementStatus, t.rejectionReason, "mileage_trip")
                      }
                      style={{
                        border: `1px solid ${color.border}`,
                        borderRadius: radius.sm,
                        padding: "4px 6px",
                        fontSize: fontSize.tiny + 0.5,
                        fontWeight: fontWeight.semibold,
                        background: reimbursementChip[status].bg,
                        color: reimbursementChip[status].text,
                      }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s} disabled={!currentUser || !canTransitionReimbursement(s, currentUser.role, currentUser)}>
                          {reimbursementChip[s].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      style={{
                        fontSize: fontSize.tiny + 0.5,
                        fontWeight: fontWeight.bold,
                        padding: "3px 8px",
                        borderRadius: radius.pill,
                        background: reimbursementChip[status].bg,
                        color: reimbursementChip[status].text,
                      }}
                    >
                      {reimbursementChip[status].label}
                    </span>
                  )}
                  {canDelete(t) ? (
                    <button
                      type="button"
                      onClick={() => confirmDelete(t)}
                      aria-label="Delete trip"
                      style={{ cursor: "pointer", background: "none", border: "none", padding: 0, display: "flex", flexShrink: 0 }}
                    >
                      <TrashIcon color={color.textFaint} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                className="flex sm:hidden"
                style={{ flexDirection: "column", gap: 6, padding: "11px 20px", borderBottom: `1px solid ${color.borderSubtle}`, fontSize: fontSize.body }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: fontWeight.semibold }}>{nameOf(users, t.userId)}</span>
                  <span style={{ fontWeight: fontWeight.bold }}>{formatMoney(t.amountMinor, currency)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTripId(t.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    color: color.textMuted,
                    fontSize: fontSize.small,
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span>
                    {formatShortDate(t.tripDate)} · {t.purpose}
                  </span>
                  <span>
                    {t.distance.toFixed(1)} {t.distanceUnit}
                  </span>
                </button>
                {canDelete(t) ? (
                  <button
                    type="button"
                    onClick={() => confirmDelete(t)}
                    style={{
                      alignSelf: "flex-start",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: color.textFaint,
                      fontSize: fontSize.small,
                    }}
                  >
                    <TrashIcon color={color.textFaint} />
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          );
        })
      )}

      {selectedTrip && currentUser ? (
        <MileageTripDrawer
          trip={selectedTrip}
          currency={currency}
          creatorName={nameOf(users, selectedTrip.userId)}
          canAct={canAct}
          viewerRole={currentUser.role}
          viewerAuthority={currentUser}
          onClose={() => setSelectedTripId(null)}
          onRequestStatusChange={(status) =>
            requestReimbursementChange(selectedTrip.id, selectedTrip.purpose, status, selectedTrip.rejectionReason, "mileage_trip")
          }
        />
      ) : null}
    </div>
  );
}
