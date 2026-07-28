-- Payment gating: a brand-new workspace starts blocked ('inactive') until
-- its owner completes Stripe Checkout -- "no payment, no scan" per the
-- agreed model. Every workspace that already exists at the time this
-- migration runs is grandfathered in as 'active' so nobody currently using
-- the app gets locked out by it.
--
-- Enforced at the application layer (AppShell's BillingGate), not RLS --
-- unlike reimbursement authority, this is a business/billing gate rather
-- than a data-integrity boundary, and gating every table's policies on
-- workspace billing status would be a lot of surface area for comparatively
-- little security benefit. Known tradeoff: a determined technical user
-- calling the API directly could bypass the UI gate.
alter table workspaces add column billing_status text not null default 'inactive'
  check (billing_status in ('inactive', 'active', 'past_due', 'canceled'));
alter table workspaces add column stripe_customer_id text;
alter table workspaces add column stripe_subscription_id text;

update workspaces set billing_status = 'active';
