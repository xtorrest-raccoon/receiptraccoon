import type { CurrentUser, WorkspaceUser } from "@rr/api";
import { formatMoney, isAdmin, type TeamMemberSummary } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useSetReimbursementAuthority } from "../lib/queries";
import { Avatar } from "./Avatar";
import { CategoryChip } from "./Chips";

function findUser(users: WorkspaceUser[], userId: string): WorkspaceUser | undefined {
  return users.find((u) => u.id === userId);
}

export function TeamMembersTable({
  members,
  currency,
  users,
  currentUser,
}: {
  members: TeamMemberSummary[];
  currency: string;
  users: WorkspaceUser[];
  currentUser: CurrentUser;
}) {
  const setAuthority = useSetReimbursementAuthority();
  // Mirrors can_grant_reimbursement_authority() in 0007_reimbursement_authority.sql —
  // owner/admin, or a super user (both capabilities already granted). A refund-only
  // or approve-only person deliberately cannot grant, so they can't self-escalate.
  const canGrant = isAdmin(currentUser.role) || (currentUser.canApproveReimbursements && currentUser.canProcessReimbursements);

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], overflow: "hidden" }}>
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1.8fr 0.8fr 1.1fr 0.9fr 1.2fr 1.3fr",
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
        <div>Reimbursement authority</div>
      </div>

      {members.map((u) => {
        const aged = u.oldestPendingDays != null && u.oldestPendingDays > 30;
        const member = findUser(users, u.userId);
        return (
          <div key={u.userId}>
            <div
              className="hidden sm:grid"
              style={{
                gridTemplateColumns: "1.8fr 0.8fr 1.1fr 0.9fr 1.2fr 1.3fr",
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
              <div>
                {member ? (
                  isAdmin(member.role) ? (
                    <span style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint }}>Admin (full authority)</span>
                  ) : (
                    <div style={{ display: "flex", gap: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: fontSize.tiny + 0.5, color: color.textMuted, cursor: canGrant ? "pointer" : "default" }}>
                        <input
                          type="checkbox"
                          checked={member.canApproveReimbursements}
                          disabled={!canGrant}
                          onChange={(e) =>
                            setAuthority.mutate({ userId: member.id, canApprove: e.target.checked, canProcess: member.canProcessReimbursements })
                          }
                        />
                        Approve
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: fontSize.tiny + 0.5, color: color.textMuted, cursor: canGrant ? "pointer" : "default" }}>
                        <input
                          type="checkbox"
                          checked={member.canProcessReimbursements}
                          disabled={!canGrant}
                          onChange={(e) =>
                            setAuthority.mutate({ userId: member.id, canApprove: member.canApproveReimbursements, canProcess: e.target.checked })
                          }
                        />
                        Refund
                      </label>
                    </div>
                  )
                ) : null}
              </div>
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
              {member && !isAdmin(member.role) ? (
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: fontSize.small, color: color.textMuted }}>
                    <input
                      type="checkbox"
                      checked={member.canApproveReimbursements}
                      disabled={!canGrant}
                      onChange={(e) =>
                        setAuthority.mutate({ userId: member.id, canApprove: e.target.checked, canProcess: member.canProcessReimbursements })
                      }
                    />
                    Approve
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: fontSize.small, color: color.textMuted }}>
                    <input
                      type="checkbox"
                      checked={member.canProcessReimbursements}
                      disabled={!canGrant}
                      onChange={(e) =>
                        setAuthority.mutate({ userId: member.id, canApprove: member.canApproveReimbursements, canProcess: e.target.checked })
                      }
                    />
                    Refund
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
