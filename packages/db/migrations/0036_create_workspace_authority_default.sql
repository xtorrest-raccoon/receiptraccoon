-- Same gap 0029_admin_reimbursement_authority_default.sql already fixed for
-- handle_new_user() and accept_workspace_invite() existed on this third path
-- too: create_workspace() (an existing user adding an ADDITIONAL workspace --
-- see packages/api's createWorkspace) inserted the new owner row without
-- setting can_approve_reimbursements/can_process_reimbursements. The UI
-- (canTransitionReimbursement in @rr/shared) assumes every owner/admin
-- already has both, so their Approve/Reject buttons render enabled
-- regardless -- clicking one then hits a raw, unexplained 403 from
-- enforce_reimbursement_authority(). This is exactly why a workspace's own
-- owner could see themselves blocked from approving someone else's expense
-- in a workspace they just created.
create or replace function create_workspace(p_name text, p_organization_id uuid)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  new_ws_id uuid;
begin
  if not is_organization_admin(p_organization_id) then
    raise exception 'Not authorized to add a workspace to this organization';
  end if;

  insert into workspaces (name, organization_id) values (p_name, p_organization_id)
  returning id into new_ws_id;

  insert into workspace_members (workspace_id, user_id, role, can_approve_reimbursements, can_process_reimbursements)
  values (new_ws_id, auth.uid(), 'owner', true, true);

  return new_ws_id;
end;
$$;

-- One-time backfill for any workspace already sitting in this gap (like
-- "ReceiptRaccoon Demo" right now) -- same idempotent shape as 0029's own
-- backfill, safe to run regardless of how many times.
update workspace_members
set can_approve_reimbursements = true, can_process_reimbursements = true
where role in ('owner', 'admin')
  and (can_approve_reimbursements = false or can_process_reimbursements = false);
