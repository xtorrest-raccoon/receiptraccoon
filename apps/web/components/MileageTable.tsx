"use client";

import { formatMoney, formatShortDate, isAdmin, type MileageTrip, type ReimbursementStatus } from "@rr/shared";
import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import { getCurrentUser, userName } from "../lib/data";

const STATUS_OPTIONS: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];

/**
 * @rr/mock-api has no mutator for mileage trip status (only setReimbursementStatus
 * for receipts). The status control here therefore updates local page state only,
 * same as the design's own localStorage-backed prototype — neither persists to a
 * real backend, since one doesn't exist yet for mileage.
 */
export function MileageTable({
  trips,
  currency,
  statusOverrides,
  onStatusChange,
}: {
  trips: MileageTrip[];
  currency: string;
  statusOverrides: Record<string, ReimbursementStatus>;
  onStatusChange: (tripId: string, status: ReimbursementStatus) => void;
}) {
  const admin = isAdmin(getCurrentUser().role);

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
          const status = statusOverrides[t.id] ?? t.reimbursementStatus;
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
                <div style={{ color: color.textMuted }}>{formatShortDate(t.tripDate)}</div>
                <div style={{ fontWeight: fontWeight.semibold }}>{userName(t.userId)}</div>
                <div style={{ color: color.textStrong }}>{t.purpose}</div>
                <div style={{ color: color.textMuted }}>
                  {t.distance.toFixed(1)} {t.distanceUnit}
                </div>
                <div style={{ fontWeight: fontWeight.bold }}>{formatMoney(t.amountMinor, currency)}</div>
                <div>
                  {admin ? (
                    <select
                      value={status}
                      onChange={(e) => onStatusChange(t.id, e.target.value as ReimbursementStatus)}
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
                        <option key={s} value={s}>
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
                  <span style={{ fontWeight: fontWeight.semibold }}>{userName(t.userId)}</span>
                  <span style={{ fontWeight: fontWeight.bold }}>{formatMoney(t.amountMinor, currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: color.textMuted, fontSize: fontSize.small }}>
                  <span>
                    {formatShortDate(t.tripDate)} · {t.purpose}
                  </span>
                  <span>
                    {t.distance.toFixed(1)} {t.distanceUnit}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
