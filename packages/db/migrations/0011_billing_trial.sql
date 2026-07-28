-- First-month-free trial: a brand-new workspace's Checkout session grants
-- trial_period_days (see create-checkout-session), capped at 5 seats while
-- trialing. trial_used stops a workspace being re-granted a trial after it
-- cancels and resubscribes. trial_ended_early flags that the cap was
-- exceeded and billing started immediately -- drives the one-time in-app
-- notice (TrialEndedBanner) and the email sent from sync-seats.
alter table workspaces add column trial_ends_at timestamptz;
alter table workspaces add column trial_used boolean not null default false;
alter table workspaces add column trial_ended_early boolean not null default false;

-- Every workspace already grandfathered to 'active' in 0010 got there
-- without ever going through Checkout -- mark trial_used so none of them
-- are retroactively offered a trial if their billing ever needs to restart.
update workspaces set trial_used = true where billing_status = 'active';
