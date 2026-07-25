-- The country a receipt was issued in — detected by the extraction step
-- from the same evidence (address, language, phone format) it already uses
-- to detect currency, since currency alone can't distinguish countries that
-- share one (EUR spans ~20). ISO 3166-1 alpha-2, nullable — a genuinely
-- unclear photo returns null rather than a guessed code.
--
-- No RLS change needed: the existing receipts_select/insert/update policies
-- already cover all columns generically.

alter table receipts add column country char(2);
