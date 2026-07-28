-- Fixes a real underpayment bug: mileageAmountForTrip always treated
-- rate_milli as canonically per-mile, but a workspace whose mileage_unit is
-- "km" stores (and its Settings screen labels) the rate as per-km --
-- so every km-workspace trip was paid out at ~62% of what it should have
-- been. rate_unit records, per trip, which unit the frozen rate_milli is
-- actually expressed in, so the calculation can convert distance into the
-- RIGHT unit instead of always assuming miles.
--
-- Backfilled from each trip's workspace's CURRENT mileage_unit -- the best
-- available signal, since no per-trip record of "what unit was active when
-- this was logged" existed before now. Amounts for affected (km-rate) trips
-- are corrected separately by a one-off script using the same Decimal.js
-- money math as production, not hand-rolled SQL arithmetic.
alter table mileage_trips add column rate_unit text not null default 'mi'
  check (rate_unit in ('mi', 'km'));

update mileage_trips t
set rate_unit = w.mileage_unit
from workspaces w
where w.id = t.workspace_id;
