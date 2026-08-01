-- Consolidated seat count for billing: distinct PEOPLE across every
-- workspace in the caller's organization, not memberships (someone in two
-- workspaces under the same org counts once) -- see the earlier decision to
-- eventually consolidate Stripe billing per-organization on this basis.
-- This RPC only surfaces the count for display on the Invoice & Payment
-- page; billing itself is still charged per-workspace today.
--
-- Security-definer because members_select's RLS (0001_init.sql) only lets a
-- caller see workspace_members rows for workspaces they belong to -- an
-- owner/admin of workspace A cannot otherwise see membership rows for
-- workspace B under the same org that they never joined.
create or replace function get_consolidated_seat_count(p_workspace_id uuid)
returns int language plpgsql security definer
set search_path = public as $$
declare
  org_id uuid;
  seat_count int;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Not authorized to view this workspace''s seat count'
      using errcode = '42501';
  end if;

  select organization_id into org_id from workspaces where id = p_workspace_id;

  select count(distinct m.user_id) into seat_count
  from workspace_members m
  join workspaces w on w.id = m.workspace_id
  where w.organization_id = org_id;

  return seat_count;
end $$;
