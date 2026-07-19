import type { BudgetTip } from "@rr/shared";
import { color, fontSize, fontWeight, healthChip, radius, reimbursementChip } from "@rr/ui-tokens";

function chipFor(tone: BudgetTip["tone"]) {
  if (tone === "positive") return healthChip.onTrack;
  if (tone === "warn") return healthChip.atRisk;
  if (tone === "info") return reimbursementChip.approved;
  return healthChip.needsAttention; // neutral
}

export function TipsCard({ tips }: { tips: BudgetTip[] }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 22 }}>
      <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 2 }}>Tips to optimize your budget</div>
      <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>Based on this month&rsquo;s activity</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tips.map((tip, i) => {
          const chip = chipFor(tip.tone);
          return (
            <div key={i} style={{ display: "flex", gap: 10, padding: 12, borderRadius: radius.lg, background: color.surfaceMuted }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: radius.sm + 1,
                  background: chip.bg,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: fontSize.small - 1,
                  fontWeight: fontWeight.heavy,
                  color: chip.text,
                }}
              >
                {tip.iconLetter}
              </div>
              <div style={{ fontSize: fontSize.small + 0.5, color: color.textStrong, lineHeight: 1.5 }}>{tip.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
