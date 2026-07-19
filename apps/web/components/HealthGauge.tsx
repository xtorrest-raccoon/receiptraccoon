"use client";

import { useEffect, useRef, useState } from "react";
import type { HealthResult } from "@rr/shared";
import { color, fontSize, fontWeight, healthChip, radius } from "@rr/ui-tokens";

const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function chipFor(label: HealthResult["label"]) {
  if (label === "On track") return healthChip.onTrack;
  if (label === "Needs attention") return healthChip.needsAttention;
  return healthChip.atRisk;
}

export function HealthGauge({ health }: { health: HealthResult }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const target = health.score;
    const step = target >= animatedScore ? 3 : -3;
    timerRef.current = setInterval(() => {
      setAnimatedScore((cur) => {
        const next = cur + step;
        if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
          if (timerRef.current) clearInterval(timerRef.current);
          return target;
        }
        return next;
      });
    }, 25);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health.score]);

  const chip = chipFor(health.label);
  const dashOffset = CIRCUMFERENCE - (CIRCUMFERENCE * animatedScore) / 100;

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
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Financial health</div>
      </div>
      <div style={{ width: "100%", fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>Current status</div>

      <div style={{ position: "relative", width: 150, height: 150 }}>
        <svg width={150} height={150} viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={75} cy={75} r={RADIUS} fill="none" stroke={color.borderSubtle} strokeWidth={14} />
          <circle
            cx={75}
            cy={75}
            r={RADIUS}
            fill="none"
            stroke={color.brand}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
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
          <div style={{ fontSize: fontSize.statLg, fontWeight: fontWeight.heavy }}>{animatedScore}</div>
          <div style={{ fontSize: fontSize.tiny, color: color.textMuted, fontWeight: fontWeight.semibold }}>out of 100</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "5px 12px",
          borderRadius: radius.pill,
          background: chip.bg,
          color: chip.text,
          fontSize: fontSize.small,
          fontWeight: fontWeight.bold,
        }}
      >
        {health.label}
      </div>
      <div style={{ fontSize: fontSize.small, color: color.textMuted, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
        {health.explanation}
      </div>

      {health.factors.length > 0 ? (
        <div
          style={{
            width: "100%",
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${color.borderSubtle}`,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {health.factors.map((f) => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: fontSize.tiny + 0.5, color: color.textStrong, fontWeight: fontWeight.medium }}>
                {f.label} ({f.weight}%)
              </span>
              <span style={{ fontSize: fontSize.tiny + 0.5, color: color.textMuted, fontWeight: fontWeight.semibold, textAlign: "right" }}>
                {Math.round(f.score)} · {f.detail}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
