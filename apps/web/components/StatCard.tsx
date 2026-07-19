import type { ReactNode } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";

export function StatCard({
  label,
  value,
  sub,
  subColor,
  valueSize = fontSize.stat,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  subColor?: string;
  valueSize?: number;
}) {
  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius["2xl"],
        padding: "18px 20px",
      }}
    >
      <div style={{ fontSize: fontSize.small, color: color.textMuted, fontWeight: fontWeight.semibold, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: valueSize, fontWeight: fontWeight.heavy, letterSpacing: "-0.02em" }}>{value}</div>
      {sub !== undefined ? (
        <div style={{ fontSize: fontSize.small, color: subColor ?? color.textMuted, marginTop: 6, fontWeight: subColor ? fontWeight.semibold : fontWeight.regular }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}
