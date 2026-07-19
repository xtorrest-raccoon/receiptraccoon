"use client";

import { useMemo, useState } from "react";
import { categoryAccent, formatMoney, formatMonthLabel } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { getDashboard, listReceipts } from "../lib/data";

export function CategoryBreakdownCard({ currency, defaultMonth }: { currency: string; defaultMonth: string }) {
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    for (const r of listReceipts({})) {
      if (r.receiptDate) months.add(r.receiptDate.slice(0, 7));
    }
    return [...months].sort();
  }, []);

  const [month, setMonth] = useState(defaultMonth);
  const breakdown = useMemo(() => getDashboard(month).categoryBreakdown, [month]);

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Spend by category</div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            border: `1px solid ${color.borderStrong}`,
            borderRadius: radius.sm,
            padding: "6px 10px",
            fontSize: fontSize.small,
            fontWeight: fontWeight.semibold,
            background: color.surface,
            color: color.text,
          }}
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {breakdown.length === 0 ? (
        <div style={{ fontSize: fontSize.small, color: color.textFaint, padding: "20px 0" }}>No spend recorded for this month.</div>
      ) : (
        <>
          <div style={{ display: "flex", height: 14, borderRadius: radius.sm + 1, overflow: "hidden", marginBottom: 16 }}>
            {breakdown.map((c) => (
              <div key={c.categoryId ?? c.name} style={{ width: `${c.pct}%`, background: categoryAccent(c.name) }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
            {breakdown.map((c) => (
              <div key={c.categoryId ?? c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: fontSize.body }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 3, background: categoryAccent(c.name), flexShrink: 0 }} />
                  <span style={{ color: color.text, whiteSpace: "nowrap" }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontWeight: fontWeight.bold }}>{formatMoney(c.amountMinor, currency)}</span>
                  <span style={{ color: color.textFaint }}>{Math.round(c.pct)}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
