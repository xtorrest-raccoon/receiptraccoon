-- A workspace with exactly one owner ("System Admin" -- see
-- ReimbursementAuthorityTable) has a single point of failure: if that
-- one person loses access, nobody else can act as owner to fix it. This
-- adds a way for an existing owner to promote a co-member to a second
-- owner, plus a hard floor once a workspace reaches two: neither can be
-- demoted or removed without a third owner first, since dropping straight
-- from 2 back to 1 would silently undo the whole point of having two.
--
-- Owner-only to grant (not just admin) -- an admin promoting someone to
-- owner would let a non-owner mint a peer with authority over the admin
-- who granted it, which defeats the "only an owner can create another
-- owner" chain of trust.
create or replace function promote_to_owner(p_workspace_id uuid, p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only an existing System Admin can promote another one' using errcode = '42501';
  end if;

  update workspace_members
  set role = 'owner', can_approve_reimbursements = true, can_process_reimbursements = true
  where workspace_id = p_workspace_id and user_id = p_user_id;

  if not found then
    raise exception 'That person is not a member of this workspace' using errcode = '22023';
  end if;
end $$;

-- Defense in depth: the UI has no path to demote or remove an owner today,
-- but this guards any future one (or a direct API/SQL call) the same way
-- 0009_reimbursement_assignments.sql's trigger already guards reimbursement
-- authority -- enforced in Postgres, not just app code, so it holds
-- regardless of which client is writing.
create or replace function enforce_two_system_admins()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  remaining_owners int;
begin
  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  -- Skip entirely if the whole workspace is being deleted (cascade) -- the
  -- workspace row is gone from `workspaces` by the time this cascade fires.
  if not exists (select 1 from workspaces where id = old.workspace_id) then
    return coalesce(new, old);
  end if;

  -- Leaving a workspace entirely (accept_workspace_invite abandons the solo
  -- starter workspace every signup gets) is already expected, pre-existing
  -- behavior, not something this guard needs to stop -- it only protects
  -- an owner count for a workspace that still has anyone left in it.
  if not exists (select 1 from workspace_members where workspace_id = old.workspace_id and user_id <> old.user_id) then
    return coalesce(new, old);
  end if;

  select count(*) into remaining_owners
  from workspace_members
  where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id;

  -- A brand-new workspace starts with exactly one owner (handle_new_user) --
  -- that lone owner staying protected is unchanged, existing behavior, not
  -- a new restriction. Once a workspace has actually reached two, neither
  -- can drop back to one without promoting a third first.
  if remaining_owners = 0 then
    raise exception 'A workspace must always have at least one System Admin' using errcode = '23514';
  elsif remaining_owners = 1 then
    raise exception 'This workspace has two System Admins for redundancy -- promote a third before removing one' using errcode = '23514';
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists workspace_members_enforce_two_owners on workspace_members;
create trigger workspace_members_enforce_two_owners
  before update or delete on workspace_members
  for each row execute function enforce_two_system_admins();
