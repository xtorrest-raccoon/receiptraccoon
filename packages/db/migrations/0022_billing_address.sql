-- Customer billing address, for proper accounting on invoices Stripe
-- generates -- legal name, address, and tax ID are synced to the Stripe
-- Customer object (see /api/billing/update-address) so Stripe's own
-- invoice PDFs pick them up automatically; stored here too as the source
-- of truth this app displays back on the Invoice & Payment page.
--
-- Nullable throughout -- a workspace mid-checkout, or one that never
-- bothered filling this in, just gets Stripe's default (blank) invoice
-- header, same as today.
--
-- billing_country is ISO 3166-1 alpha-2, same convention as receipts.country.
-- billing_email is who Stripe actually emails the invoice PDF to -- often a
-- different inbox (accounts@company.com) than whoever is logged into the app.
alter table workspaces add column billing_legal_name text;
alter table workspaces add column billing_address_line1 text;
alter table workspaces add column billing_address_line2 text;
alter table workspaces add column billing_city text;
alter table workspaces add column billing_state text;
alter table workspaces add column billing_postal_code text;
alter table workspaces add column billing_country text;
alter table workspaces add column billing_tax_id text;
alter table workspaces add column billing_email text;
