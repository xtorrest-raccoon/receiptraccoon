"use client";

import { useState } from "react";
import {
  canTransitionReimbursement,
  formatMoney,
  formatShortDate,
  hasAnyReimbursementAuthority,
  isAdmin,
  type MileageTrip,
  type ReimbursementStatus,
} from "@rr/shared";
import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import type { WorkspaceUser } from "@rr/api";
import { useCurrentUser } from "../lib/queries";
import { useDataStore } from "../lib/store";
import { MileageTripDrawer } from "./MileageTripDrawer";

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
  const admin = currentUser ? isAdmin(currentUser.role) : false;
  const canAct = currentUser ? admin || hasAnyReimbursementAuthority(currentUser) : false;
  const { requestReimbursementChange } = useDataStore();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null;

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden" }}>
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1fr 1.4fr 1.3fr 0.9fr 0.9fr 1fr",
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
                  gridTemplateColumns: "1fr 1.4fr 1.3fr 0.9fr 0.9fr 1fr",
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
                <button
                  type="button"
                  onClick={() => setSelectedTripId(t.id)}
                  style={{ cursor: "pointer", fontWeight: fontWeight.bold, background: "none", border: "none", textAlign: "left", padding: 0, color: color.text, fontFamily: "inherit", fontSize: "inherit" }}
                >
                  {formatMoney(t.amountMinor, currency)}
                </button>
                <div>
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
