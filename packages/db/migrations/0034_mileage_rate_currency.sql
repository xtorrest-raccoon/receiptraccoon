-- A mileage rate is now denominated in whichever currency Setup's "User
-- currency & mileage setup" table has selected for that person (their own
-- display_currency), not always the workspace's home currency -- that
-- per-person Currency column takes precedence over the workspace default.
-- Mirrors receipts' own original_currency/original_total_minor/fx_rate/
-- fx_rate_date pattern: amount_minor stays the workspace-currency figure
-- everything else (Team totals, payroll) relies on, while these columns
-- preserve the frozen, as-entered fact for anyone whose rate currency
-- differed from the workspace's at the time. Null means "no conversion was
-- needed" -- the rate was already in the workspace's own currency.
alter table mileage_trips add column original_currency text;
alter table mileage_trips add column original_amount_minor bigint;
alter table mileage_trips add column fx_rate numeric;
alter table mileage_trips add column fx_rate_date date;
