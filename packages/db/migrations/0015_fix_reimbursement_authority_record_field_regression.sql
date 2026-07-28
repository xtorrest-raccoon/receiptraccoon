-- Re-fixes the exact bug 0002 already fixed once: 0009's rewrite of
-- enforce_reimbursement_authority() reverted the owner_id lookup back to a
-- direct `new.created_by`/`new.user_id` CASE. Since this one trigger
-- function is shared by both receipts and mileage_trips, NEW is a generic
-- record, and Postgres validates every CASE branch against it eagerly --
-- even the branch that won't run. That breaks EVERY reimbursement-status
-- change on EITHER table with "record new has no field ...".
--
-- Same fix as 0002: to_jsonb(new)->>'field' is a dynamic, always-safe
-- lookup that returns NULL for a field that doesn't exist on the row
-- instead of erroring -- kept alongside 0009's newer assignment-scoped
-- authority logic, which is otherwise unchanged here.
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

  owner_id := case tg_argv[0]
    when 'receipt' then (to_jsonb(new)->>'created_by')::uuid
    else (to_jsonb(new)->>'user_id')::uuid
  end;

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
