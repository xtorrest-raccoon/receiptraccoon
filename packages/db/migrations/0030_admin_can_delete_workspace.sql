-- Owner is now only "the one person who can't be removed or demoted" (see
-- Setup's Profile Definition) -- deleting the workspace no longer needs to
-- be a separate, stricter tier on top of that. An admin already has full
-- authority over everything else in it, and the UI already requires the
-- actor's own password to confirm this action (see Sidebar's
-- PasswordConfirmModal), so the extra owner-only restriction here was the
-- last meaningful gap between the two roles for no real safety benefit.
create or replace function delete_workspace(p_workspace_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  other_count int;
begin
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Only a workspace owner or admin can delete it' using errcode = '42501';
  end if;

  select count(*) into other_count
  from workspace_members
  where user_id = auth.uid() and workspace_id <> p_workspace_id;

  if other_count = 0 then
    raise exception 'Cannot delete your only workspace' using errcode = '55006';
  end if;

  delete from workspaces where id = p_workspace_id;
end $$;
