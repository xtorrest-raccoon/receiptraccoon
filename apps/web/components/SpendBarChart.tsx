import { formatMoneyCompact, formatShortDate } from "@rr/shared";
import { color, fontSize, fontWeight, healthChip, radius } from "@rr/ui-tokens";

export function SpendBarChart({
  weeklySpend,
  currency,
}: {
  weeklySpend: { weekStart: string; totalMinor: number }[];
  currency: string;
}) {
  const max = Math.max(...weeklySpend.map((w) => w.totalMinor), 1);

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Spend over time</div>
          <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2 }}>Last {weeklySpend.length} weeks</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 170, padding: "0 4px" }}>
        {weeklySpend.map((wk, i) => {
          const heightPx = Math.max(10, Math.round((wk.totalMinor / max) * 140));
          const isLast = i === weeklySpend.length - 1;
          return (
            <div
              key={wk.weekStart}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                height: "100%",
                justifyContent: "flex-end",
              }}
            >
              <div style={{ fontSize: fontSize.tiny, fontWeight: fontWeight.bold, color: color.textStrong }}>
                {formatMoneyCompact(wk.totalMinor, currency)}
              </div>
              <div
                title={`Week of ${formatShortDate(wk.weekStart)}`}
                style={{
                  width: "100%",
                  maxWidth: 38,
                  height: heightPx,
                  borderRadius: radius.lg - 4,
                  background: isLast ? color.brand : healthChip.onTrack.bg,
                }}
              />
              <div style={{ fontSize: fontSize.tiny, color: color.textFaint }}>{formatShortDate(wk.weekStart)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
