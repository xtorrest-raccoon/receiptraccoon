-- Opt-in, workspace-wide toggle for a daily digest email (sent by a Vercel
-- Cron job hitting /api/cron/daily-approval-reminders) listing each
-- approver's own pending decisions -- off by default since this is a new
-- notification channel nobody's asked for yet.
alter table workspaces add column daily_approval_reminders_enabled boolean not null default false;
