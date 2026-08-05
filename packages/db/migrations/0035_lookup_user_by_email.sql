-- Lets service-role code (see apps/web/app/api/team/provision-member/route.ts)
-- find an existing auth.users row by email without paginating through
-- admin.listUsers() (that endpoint has no email filter). Needed because
-- removeMember() deliberately never deletes the underlying auth account --
-- only the workspace_members row -- so re-provisioning the same email after
-- someone was removed hits Supabase's own "already registered" error on
-- admin.createUser(). This lets that route detect that case and re-attach
-- the existing account to the workspace instead of failing outright.
--
-- security definer to read auth.users at all; EXECUTE is revoked from
-- public/anon/authenticated below so this can only ever be reached via the
-- service-role key, never from a signed-in user's own client -- otherwise
-- this would be a plain email-enumeration oracle.
create or replace function get_user_id_by_email(lookup_email text)
returns uuid language sql security definer
set search_path = public as $$
  select id from auth.users where email = lookup_email limit 1;
$$;

revoke all on function get_user_id_by_email(text) from public;
revoke all on function get_user_id_by_email(text) from anon;
revoke all on function get_user_id_by_email(text) from authenticated;
