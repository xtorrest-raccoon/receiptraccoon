"use client";

import { useState } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { TODAY } from "../lib/data";

/**
 * Asks for a start/end date before exporting -- every receipt in that range
 * is included regardless of reimbursement status, unlike the on-screen
 * table's own status filter (which only ever narrows what's displayed, not
 * what a fresh export should contain).
 */
export function ExportCsvDateRangeModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(TODAY);

  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "color-mix(in oklch, black 45%, transparent)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 360, background: color.surface, borderRadius: radius["2xl"], padding: 24 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 6 }}>Export receipts</div>
        <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          Every receipt in this date range is included, whatever its status — pending, approved, reimbursed, or
          rejected.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 4 }}>
              Start date
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || undefined}
              style={{ width: "100%", border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, padding: "9px 12px", fontSize: fontSize.body }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 4 }}>
              End date
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              style={{ width: "100%", border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, padding: "9px 12px", fontSize: fontSize.body }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ flex: 1, padding: "9px 0", borderRadius: radius.md, border: "none", background: color.surfaceMuted, color: color.textMuted, fontWeight: fontWeight.bold, fontSize: fontSize.body, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(startDate, endDate)}
            disabled={!startDate || !endDate}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: radius.md,
              border: "none",
              background: color.brand,
              color: "#fff",
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              cursor: !startDate || !endDate ? "not-allowed" : "pointer",
              opacity: !startDate || !endDate ? 0.6 : 1,
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
