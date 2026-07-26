-- Admin/owner-provisioned member accounts get a random temporary password
-- (see apps/web/app/api/team/provision-member) and must change it before
-- using the app further. Self-registered owners, who set their own password
-- at signup, never have this set.
--
-- No new RLS needed: profiles_update already lets a user update their own
-- row (id = auth.uid()) — clearing this flag after a real password change is
-- just another self-update. Setting it TRUE for someone ELSE happens via the
-- provisioning route's service-role client, which already bypasses RLS.
alter table profiles add column must_change_password boolean not null default false;
