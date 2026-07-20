"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoneyCompact, formatPaceComparison } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";

const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MARKER_RADIUS = 4.5;

/**
 * Spending pacing ring.
 *
 * The full circle is LAST MONTH'S TOTAL, so 100% means something concrete
 * rather than being an arbitrary scale: a full ring means this month has already
 * matched everything spent last month. The fill is this month's spend so far.
 *
 * The tick mark is where the fill would sit if spending were perfectly flat —
 * how far through the month we are. Fill past the marker means running ahead of
 * last month; short of it means running behind.
 */
export function SpendPacingCard({
  monthToDateMinor,
  prevMonthTotalMinor,
  deltaPct,
  elapsedFraction,
  currency,
}: {
  monthToDateMinor: number;
  prevMonthTotalMinor: number;
  deltaPct: number;
  elapsedFraction: number;
  currency: string;
}) {
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
  }, [monthToDateMinor, prevMonthTotalMinor]);

  // With no previous month to compare against, a full ring would imply "matched
  // last month" when there is nothing to match — show it empty instead.
  const rawFill = prevMonthTotalMinor > 0 ? monthToDateMinor / prevMonthTotalMinor : 0;
  const fill = Math.min(1, rawFill);
  const fillLen = fill * CIRCUMFERENCE * progress;

  // Spend up is bad, flat-or-down is good — same boundary used for this figure
  // everywhere else it appears.
  const deltaColor = deltaPct > 0 ? color.up : color.down;

  // The <svg> is rotated -90deg so the circle starts at 12 o'clock; the marker
  // is positioned in the untransformed space and carried round by that same
  // rotation, so 0 here is 3 o'clock and the transform lands it on top.
  const markerAngle = 2 * Math.PI * Math.min(1, Math.max(0, elapsedFraction));
  const markerX = 75 + RADIUS * Math.cos(markerAngle);
  const markerY = 75 + RADIUS * Math.sin(markerAngle);

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
      <div style={{ width: "100%", fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 18 }}>
        Spending vs Last Month
      </div>

      <div style={{ position: "relative", width: 150, height: 150 }}>
        <svg width={150} height={150} viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={75} cy={75} r={RADIUS} fill="none" stroke={color.borderSubtle} strokeWidth={14} />
          <circle
            cx={75}
            cy={75}
            r={RADIUS}
            fill="none"
            stroke={deltaColor}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${CIRCUMFERENCE - fillLen}`}
            strokeDashoffset={0}
          />
          {/* Pace marker: where a flat month would have reached by today. */}
          <circle cx={markerX} cy={markerY} r={MARKER_RADIUS} fill={color.surface} />
          <circle
            cx={markerX}
            cy={markerY}
            r={MARKER_RADIUS}
            fill="none"
            stroke={color.textMuted}
            strokeWidth={2}
          />
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
          {/* Compact (no cents): inside a ring this is a sense-of-scale figure,
              not an amount anyone reconciles against — the exact total is on the
              "Spend this month" stat card above. */}
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.heavy }}>
            {formatMoneyCompact(Math.round(monthToDateMinor * progress), currency)}
          </div>
          <div style={{ fontSize: fontSize.tiny, color: color.textMuted, fontWeight: fontWeight.semibold }}>
            of {formatMoneyCompact(prevMonthTotalMinor, currency)}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: fontSize.small,
          color: deltaColor,
          fontWeight: fontWeight.semibold,
          textAlign: "center",
          marginTop: 14,
          lineHeight: 1.5,
        }}
      >
        {formatPaceComparison(deltaPct)}
      </div>
    </div>
  );
}
