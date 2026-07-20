"use client";

import { useEffect, useRef, useState } from "react";
import type { ReceiptProcessing } from "@rr/shared";
import { formatMoney } from "@rr/shared";
import { color, fontSize, fontWeight, radius, reimbursementAccent, reimbursementChip } from "@rr/ui-tokens";

const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * "Receipt processing" card — replaces the earlier financial-health gauge.
 *
 * Each ring segment is a reimbursement status's share of claimed spend in the
 * trailing 30 days, drawn in the fixed pending/approved/reimbursed/rejected order
 * (ReceiptProcessing.segments) so a colour always means the same status. Standard
 * multi-segment donut technique: segment i's dasharray is [length_i, C -
 * length_i], dashoffset -(sum of lengths before it).
 *
 * The original single-value gauge animated via a CSS transition on dashoffset
 * alone. That does not generalise cleanly to several stacked segments changing
 * together, so this drives an explicit 0->1 progress value in JS instead and
 * recomputes every segment's dasharray/offset from it each tick — keeps all
 * segments growing in perfect sync rather than trusting independent CSS
 * transitions to stay coordinated.
 */
export function ProcessingCard({ processing, currency }: { processing: ReceiptProcessing; currency: string }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((cur) => {
        const next = cur + 1 / 32;
        if (next >= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 1;
        }
        return next;
      });
    }, 25);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing.totalMinor, processing.segments.length]);

  let cumulative = 0;

  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius["2xl"],
        padding: 22,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 4 }}>
        Receipt processing
      </div>
      <div style={{ width: "100%", fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>
        Last 30 days
      </div>

      <div style={{ position: "relative", width: 150, height: 150 }}>
        <svg width={150} height={150} viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={75} cy={75} r={RADIUS} fill="none" stroke={color.borderSubtle} strokeWidth={14} />
          {processing.segments.map((seg) => {
            const segLen = (seg.pct / 100) * CIRCUMFERENCE * progress;
            const offsetBefore = cumulative;
            cumulative += segLen;
            return (
              <circle
                key={seg.status}
                cx={75}
                cy={75}
                r={RADIUS}
                fill="none"
                stroke={reimbursementAccent[seg.status]}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={`${segLen} ${CIRCUMFERENCE - segLen}`}
                strokeDashoffset={-offsetBefore}
              />
            );
          })}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: fontSize.statLg, fontWeight: fontWeight.heavy }}>
            {formatMoney(Math.round(processing.totalMinor * progress), currency)}
          </div>
          <div style={{ fontSize: fontSize.tiny, color: color.textMuted, fontWeight: fontWeight.semibold }}>
            {processing.receiptCount} receipt{processing.receiptCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {processing.segments.length === 0 ? (
        <div style={{ fontSize: fontSize.small, color: color.textFaint, marginTop: 14 }}>
          No receipts in the last 30 days.
        </div>
      ) : (
        <div style={{ width: "100%", marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {processing.segments.map((seg) => (
            <div
              key={seg.status}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: fontSize.body }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    background: reimbursementAccent[seg.status],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: color.text, whiteSpace: "nowrap" }}>{reimbursementChip[seg.status].label}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <span style={{ fontWeight: fontWeight.bold }}>{formatMoney(seg.amountMinor, currency)}</span>
                <span style={{ color: color.textFaint }}>{Math.round(seg.pct)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
