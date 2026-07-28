-- Cancellation: mirrors Stripe's own subscription-cancellation shape rather
-- than inventing our own. cancel_at_period_end tracks a paid subscription
-- scheduled to stop at the end of what's already been paid for (undoable via
-- /api/billing/resume-subscription up until it actually ends); a trial
-- cancellation instead calls stripe.subscriptions.cancel() directly (ends
-- access immediately, since nothing was ever charged) and never sets this
-- flag. current_period_end is what the UI shows as "access until <date>".
alter table workspaces add column cancel_at_period_end boolean not null default false;
alter table workspaces add column current_period_end timestamptz;
