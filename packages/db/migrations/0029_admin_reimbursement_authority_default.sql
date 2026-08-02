-- Approving/refunding your OWN claim always requires the capability
-- booleans, even for an owner/admin -- see enforce_reimbursement_authority()
-- in 0009_reimbursement_assignments.sql: acting on your own claim never
-- gets the role-based blanket-authority bypass that acting on someone
-- ELSE's claim does, by design (self-approval is only ever permitted when
-- nobody else could act on it, and is logged as a self-approval).
--
-- 0007_reimbursement_authority.sql granted these booleans to every owner/
-- admin that existed AT THAT MOMENT, but nothing has granted them since --
-- handle_new_user() never set them for a brand-new signup's own owner row,
-- and promoting someone to admin (via provision-member or Setup's security
-- group picker) never touched them either. The UI (canTransitionReimbursement
-- in @rr/shared) assumes every admin/owner already has both, so their
-- Approve/Refund buttons render enabled regardless -- clicking one then hits
-- a raw, unexplained 403 from the trigger above. This is exactly why a
-- workspace owner/CEO could see themselves blocked from approving their own
-- single-person company's expenses despite being the account owner.
--
-- Fix going forward (handle_new_user) plus a one-time backfill for anyone
-- already sitting in this gap.
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  org_id uuid;
  ws_id  uuid;
  seed  text[] := array['Meals','Groceries','Travel','Office Supplies','Software',
                        'Fuel','Utilities','Marketing','Professional Services','Other'];
  hues  int[]  := array[40,150,230,285,262,22,195,340,305,250];
  i     int;
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  insert into organizations (name) values ('My Workspace') returning id into org_id;
  insert into workspaces (name, organization_id) values ('My Workspace', org_id) returning id into ws_id;

  insert into workspace_members (workspace_id, user_id, role, can_approve_reimbursements, can_process_reimbursements)
  values (ws_id, new.id, 'owner', true, true);

  update profiles set home_workspace_id = ws_id where id = new.id;

  for i in 1 .. array_length(seed, 1) loop
    insert into categories (workspace_id, name, hue, sort_order, is_system)
    values (ws_id, seed[i], hues[i], i, true);
  end loop;

  return new;
end $$;

-- Same gap on the invite-acceptance path: accepting an invite with role
-- 'admin' never granted these either.
create or replace function accept_workspace_invite(p_invite_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_invite  workspace_invites;
  v_old_ws  uuid;
  v_new_ws  uuid;
  v_caller  uuid := auth.uid();
begin
  select * into v_invite from workspace_invites where id = p_invite_id for update;
  if v_invite is null then
    raise exception 'Invite not found';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'Invite is no longer pending';
  end if;
  if lower(v_invite.email) <> lower(auth.email()) then
    raise exception 'This invite is not addressed to you';
  end if;

  select workspace_id into v_old_ws from workspace_members where user_id = v_caller limit 1;
  if v_old_ws is null then
    raise exception 'No current workspace found for caller';
  end if;
  v_new_ws := v_invite.workspace_id;

  if v_old_ws <> v_new_ws then
    update receipts r
    set workspace_id = v_new_ws,
        category_id = case
          when r.category_id is null then null
          else coalesce(
            (select c.id from categories c
               join categories oc on oc.id = r.category_id
               where c.workspace_id = v_new_ws and lower(c.name) = lower(oc.name)
               limit 1),
            (select c.id from categories c where c.workspace_id = v_new_ws and c.name = 'Other' limit 1)
          )
        end
    where r.created_by = v_caller and r.workspace_id = v_old_ws;

    update mileage_trips m
    set workspace_id = v_new_ws
    where m.user_id = v_caller and m.workspace_id = v_old_ws;

    delete from workspace_members where workspace_id = v_old_ws and user_id = v_caller;

    insert into workspace_members (workspace_id, user_id, role, can_approve_reimbursements, can_process_reimbursements)
    values (v_new_ws, v_caller, v_invite.role, v_invite.role = 'admin', v_invite.role = 'admin')
    on conflict (workspace_id, user_id) do update
      set role = excluded.role,
          can_approve_reimbursements = workspace_members.can_approve_reimbursements or excluded.can_approve_reimbursements,
          can_process_reimbursements = workspace_members.can_process_reimbursements or excluded.can_process_reimbursements;

    update profiles set home_workspace_id = v_new_ws where id = v_caller;
  end if;

  update workspace_invites set status = 'accepted', accepted_at = now() where id = p_invite_id;
end $$;

update workspace_members
set can_approve_reimbursements = true, can_process_reimbursements = true
where role in ('owner', 'admin')
  and (can_approve_reimbursements = false or can_process_reimbursements = false);
