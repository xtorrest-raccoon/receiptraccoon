-- Start/end addresses for a mileage trip, populated only when the trip was
-- entered via automatic (address-based) distance calculation rather than
-- typed in manually. Nullable — manual entries leave these null, same
-- "populated only when relevant" pattern as receipts.original_currency.

alter table mileage_trips add column start_address text;
alter table mileage_trips add column end_address text;
