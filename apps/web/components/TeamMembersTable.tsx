import type { TeamMemberSummary } from "@rr/shared";
import { formatMoney } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { Avatar } from "./Avatar";
import { CategoryChip } from "./Chips";

export function TeamMembersTable({ members, currency }: { members: TeamMemberSummary[]; currency: string }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden" }}>
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.4fr",
          padding: "12px 20px",
          fontSize: fontSize.tiny + 0.5,
          fontWeight: fontWeight.bold,
          color: color.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          borderBottom: `1px solid ${color.borderSubtle}`,
        }}
      >
        <div>User</div>
        <div>Receipts</div>
        <div>Outstanding refund</div>
        <div>Oldest pending</div>
        <div>Top category</div>
      </div>

      {members.map((u) => {
        const aged = u.oldestPendingDays != null && u.oldestPendingDays > 30;
        return (
          <div key={u.userId}>
            <div
              className="hidden sm:grid"
              style={{
                gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.4fr",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: `1px solid ${color.borderSubtle}`,
                fontSize: fontSize.body,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={u.name} />
                <div>
                  <div style={{ fontWeight: fontWeight.bold }}>{u.name}</div>
                  <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint }}>{u.jobTitle}</div>
                </div>
              </div>
              <div>{u.receiptCount}</div>
              <div style={{ fontWeight: fontWeight.bold }}>{formatMoney(u.outstandingMinor, currency)}</div>
              <div style={{ fontWeight: fontWeight.bold, color: aged ? color.up : color.textStrong }}>
                {u.oldestPendingDays != null ? `${u.oldestPendingDays}d` : "—"}
              </div>
              <div>{u.topCategory ? <CategoryChip category={u.topCategory} /> : <span style={{ color: color.textFaint }}>—</span>}</div>
            </div>

            <div
              className="flex sm:hidden"
              style={{ flexDirection: "column", gap: 8, padding: "14px 20px", borderBottom: `1px solid ${color.borderSubtle}`, fontSize: fontSize.body }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={u.name} />
                <div>
                  <div style={{ fontWeight: fontWeight.bold }}>{u.name}</div>
                  <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint }}>{u.jobTitle}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: color.textMuted, fontSize: fontSize.small }}>
                <span>{u.receiptCount} receipts</span>
                {u.topCategory ? <CategoryChip category={u.topCategory} /> : <span>—</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: fontWeight.bold }}>{formatMoney(u.outstandingMinor, currency)}</span>
                <span style={{ fontWeight: fontWeight.bold, color: aged ? color.up : color.textStrong }}>
                  {u.oldestPendingDays != null ? `${u.oldestPendingDays}d oldest` : "—"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
