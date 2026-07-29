"use client";

import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useDailyApprovalRemindersEnabled, useSetDailyApprovalRemindersEnabled } from "../lib/queries";

/**
 * Off by default (see 0016_daily_approval_reminders.sql) — a Vercel Cron job
 * (/api/cron/daily-approval-reminders) checks this flag once a day per
 * workspace and, if on, emails each approver their own pending queue
 * (skipped entirely for anyone whose queue is empty).
 */
export function NotificationsPanel() {
  const { data: enabled } = useDailyApprovalRemindersEnabled();
  const setEnabled = useSetDailyApprovalRemindersEnabled();

  if (enabled === undefined) return null;

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginTop: 16 }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled.mutate(e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer" }}
        />
        <div>
          <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold }}>Send daily approval reminders</div>
          <div style={{ fontSize: fontSize.small, color: color.textMuted, marginTop: 2, lineHeight: 1.5 }}>
            Once a day, anyone with approval or refund authority gets an email listing only their own pending
            receipts and mileage trips — skipped entirely on days their queue is empty.
          </div>
        </div>
      </label>
      {setEnabled.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginTop: 10 }}>Couldn&rsquo;t save that — try again.</div>
      ) : null}
    </div>
  );
}
