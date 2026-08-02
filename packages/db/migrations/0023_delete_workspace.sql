-- Owner-only, security-definer (there is no DELETE RLS policy on
-- workspaces at all -- a plain client-side delete would be rejected).
-- Stricter than the existing "remove a member" gate (isAdmin) since
-- deleting a workspace destroys every receipt, mileage trip, and
-- membership in it via the existing on-delete-cascade foreign keys
-- (0001_init.sql, 0004_workspace_invites.sql, 0009_reimbursement_assignments.sql)
-- -- irreversible for everyone in it, not just the actor.
--
-- Refuses to delete the caller's only workspace: every account keeps at
-- least one, since the rest of the app assumes a signed-in user always
-- has a workspace to fall back to (see @rr/api's getCurrentWorkspaceId).
create or replace function delete_workspace(p_workspace_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  other_count int;
begin
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the workspace owner can delete it' using errcode = '42501';
  end if;

  select count(*) into other_count
  from workspace_members
  where user_id = auth.uid() and workspace_id <> p_workspace_id;

  if other_count = 0 then
    raise exception 'Cannot delete your only workspace' using errcode = '55006';
  end if;

  delete from workspaces where id = p_workspace_id;
end $$;
