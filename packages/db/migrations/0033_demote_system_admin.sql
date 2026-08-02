-- Counterpart to promote_to_owner() -- lets an existing System Admin demote
-- one (including themselves) back to Admin. Owner-only to invoke, same
-- chain-of-trust reasoning as promoting: an admin demoting an owner would
-- let someone lower in the hierarchy strip authority from someone above
-- them. The actual floor -- never dropping a workspace below two System
-- Admins -- is already enforced by enforce_two_system_admins() from
-- 0031_second_system_admin.sql, which fires on this UPDATE the same as any
-- other write to workspace_members.role, so it isn't repeated here.
create or replace function demote_to_admin(p_workspace_id uuid, p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only an existing System Admin can demote another one' using errcode = '42501';
  end if;

  update workspace_members
  set role = 'admin'
  where workspace_id = p_workspace_id and user_id = p_user_id and role = 'owner';

  if not found then
    raise exception 'That person is not currently a System Admin of this workspace' using errcode = '22023';
  end if;
end $$;
