-- Reimbursement authority becomes scoped rather than blanket: an approver or
-- refunder with the capability but no assignments has authority over NOBODY
-- until an admin (or a super user) explicitly assigns them specific
-- employees. Admin/owner keep blanket authority over everyone regardless —
-- this table only scopes what a granted plain member can act on.
create table reimbursement_assignments (
  workspace_id uuid not null references workspaces on delete cascade,
  approver_id  uuid not null references profiles on delete cascade,
  employee_id  uuid not null references profiles on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (approver_id, employee_id)
);

alter table reimbursement_assignments enable row level security;

create policy assignments_select on reimbursement_assignments for select using (
  is_workspace_member(workspace_id)
);
-- Same audience as who can grant the underlying capability in the first
-- place — see can_grant_reimbursement_authority() in 0007.
create policy assignments_write on reimbursement_assignments for all using (
  can_grant_reimbursement_authority(workspace_id)
) with check (
  can_grant_reimbursement_authority(workspace_id)
);

-- ═══════════════════════════════════════════════════════════
-- authority checks, now assignment-aware
-- ═══════════════════════════════════════════════════════════

-- Does auth.uid() hold `capability` AND actually have authority over
-- target_user — admin/owner (blanket), or explicitly assigned to them?
create or replace function caller_has_authority_over(ws uuid, capability text, target_user uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and (
        (capability = 'approve' and can_approve_reimbursements)
        or (capability = 'process' and can_process_reimbursements)
      )
      and (
        role in ('owner', 'admin')
        or exists (
          select 1 from reimbursement_assignments
          where approver_id = auth.uid() and employee_id = target_user
        )
      )
  );
$$;

-- Any capability at all, over this specific target — used for RLS (select/
-- update don't care which of approve/process, just that SOME authority
-- reaches this row).
create or replace function caller_has_any_authority_over(ws uuid, target_user uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select caller_has_authority_over(ws, 'approve', target_user) or caller_has_authority_over(ws, 'process', target_user);
$$;

-- Does anyone OTHER than exclude_user hold `capability` AND actually have
-- authority over target_user? Used for the self-approval exception: if
-- nobody else could actually act on this person's own claim (not just "has
-- the checkbox" but "is admin or specifically assigned to them"), they're
-- allowed to act on their own, recorded as a self-approval.
create or replace function other_has_authority_over(ws uuid, capability text, target_user uuid, exclude_user uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = ws
      and wm.user_id != exclude_user
      and (
        (capability = 'approve' and wm.can_approve_reimbursements)
        or (capability = 'process' and wm.can_process_reimbursements)
      )
      and (
        wm.role in ('owner', 'admin')
        or exists (
          select 1 from reimbursement_assignments ra
          where ra.approver_id = wm.user_id and ra.employee_id = target_user
        )
      )
  );
$$;

-- ═══════════════════════════════════════════════════════════
-- reimbursement_authority trigger: capability check is now scoped by
-- assignment when acting on someone else. Acting on your OWN claim never
-- needs an assignment to yourself — only the capability, same as before.
-- ═══════════════════════════════════════════════════════════

create or replace function enforce_reimbursement_authority()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  self_approval boolean := false;
  owner_id uuid;
  required_capability text;
  has_capability boolean;
begin
  if new.reimbursement_status is not distinct from old.reimbursement_status then
    return new;
  end if;

  required_capability := case new.reimbursement_status
    when 'reimbursed' then 'process'
    else 'approve' -- approved, rejected, or back to pending
  end;

  owner_id := case tg_argv[0] when 'receipt' then new.created_by else new.user_id end;

  if owner_id = auth.uid() then
    select (case required_capability
              when 'process' then can_process_reimbursements
              else can_approve_reimbursements
            end)
    into has_capability
    from workspace_members
    where workspace_id = new.workspace_id and user_id = auth.uid();

    if not coalesce(has_capability, false) then
      raise exception 'You do not have permission to make this change'
        using errcode = '42501';
    end if;

    if new.reimbursement_status in ('approved','reimbursed') then
      if other_has_authority_over(new.workspace_id, required_capability, auth.uid(), auth.uid()) then
        raise exception 'Someone else with authority must handle your own expenses'
          using errcode = '42501';
      end if;
      -- Nobody else could actually act on this claim: permitted, but recorded as a self-approval.
      self_approval := true;
    end if;
  else
    if not caller_has_authority_over(new.workspace_id, required_capability, owner_id) then
      raise exception 'You are not authorized to act on this person''s expenses'
        using errcode = '42501';
    end if;
  end if;

  if new.reimbursement_status = 'rejected'
     and coalesce(btrim(new.rejection_reason), '') = '' then
    raise exception 'A rejection reason is required'
      using errcode = '23514';
  end if;

  insert into reimbursement_events
    (entity_type, entity_id, actor, from_status, to_status, reason, was_self_approval)
  values
    (tg_argv[0], new.id, auth.uid(), old.reimbursement_status,
     new.reimbursement_status, new.rejection_reason, self_approval);

  return new;
end $$;

-- ═══════════════════════════════════════════════════════════
-- RLS: receipts/mileage select+update now check assignment-scoped
-- authority over the SPECIFIC row's owner, not blanket workspace authority.
-- ═══════════════════════════════════════════════════════════

drop policy receipts_select on receipts;
create policy receipts_select on receipts for select using (
  is_workspace_member(workspace_id)
  and (created_by = auth.uid() or is_workspace_admin(workspace_id) or caller_has_any_authority_over(workspace_id, created_by))
);

drop policy receipts_update on receipts;
create policy receipts_update on receipts for update using (
  created_by = auth.uid() or is_workspace_admin(workspace_id) or caller_has_any_authority_over(workspace_id, created_by)
);

drop policy mileage_select on mileage_trips;
create policy mileage_select on mileage_trips for select using (
  is_workspace_member(workspace_id)
  and (user_id = auth.uid() or is_workspace_admin(workspace_id) or caller_has_any_authority_over(workspace_id, user_id))
);

drop policy mileage_update on mileage_trips;
create policy mileage_update on mileage_trips for update using (
  user_id = auth.uid() or is_workspace_admin(workspace_id) or caller_has_any_authority_over(workspace_id, user_id)
);

-- Superseded by caller_has_any_authority_over/other_has_authority_over above
-- — safe to drop now that every policy and the trigger have moved off them.
drop function if exists has_reimbursement_authority(uuid);
drop function if exists has_other_reimbursement_authority(uuid, text, uuid);
