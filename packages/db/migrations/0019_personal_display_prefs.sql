-- Personal, display-only overrides for currency and distance unit. Null
-- means "use the workspace default" (workspaces.home_currency /
-- workspaces.mileage_unit) -- these never change what's stored, what gets
-- reimbursed, or what an admin sees on Team/Dashboard, only how amounts and
-- distances are rendered to the one person who set them. Edited only from
-- the web app's Profile page (see apps/web/app/profile/page.tsx); mobile
-- and the user's own web views (MyMileagePanel) just apply the result.
--
-- No new RLS needed -- profiles_update (0001_init.sql) already lets a user
-- write their own row, and there's nothing here to validate (no FK, and an
-- unrecognized currency code just fails to look up an FX rate at read time
-- rather than corrupting anything).
alter table profiles add column display_currency char(3);
alter table profiles add column display_distance_unit text check (display_distance_unit in ('mi','km'));
