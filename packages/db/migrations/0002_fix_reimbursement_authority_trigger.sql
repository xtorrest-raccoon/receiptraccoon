-- Fix enforce_reimbursement_authority(): `new` is a generic `record` in this
-- shared trigger (used by both receipts and mileage_trips), and Postgres
-- validates every branch of a CASE expression against it eagerly — even the
-- branch that won't run. `new.user_id` doesn't exist on receipts, so any
-- reimbursement-status update on a RECEIPT failed with
-- "record "new" has no field "user_id"" even though the 'receipt' branch of
-- the CASE never touches that field.
--
-- to_jsonb(new)->>'field' is a dynamic, always-safe lookup: it returns NULL
-- for a field that doesn't exist on the row instead of erroring, so both
-- branches can coexist in the same function body for both tables.

create or replace function enforce_reimbursement_authority()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  admins int;
  self_approval boolean := false;
  owner_id uuid;
begin
  if new.reimbursement_status is not distinct from old.reimbursement_status then
    return new;
  end if;

  if not is_workspace_admin(new.workspace_id) then
    raise exception 'Only admins can change reimbursement status'
      using errcode = '42501';
  end if;

  owner_id := case tg_argv[0]
    when 'receipt' then (to_jsonb(new)->>'created_by')::uuid
    else (to_jsonb(new)->>'user_id')::uuid
  end;

  if owner_id = auth.uid()
     and new.reimbursement_status in ('approved','reimbursed') then
    admins := workspace_admin_count(new.workspace_id);
    if admins >= 2 then
      raise exception 'Another admin must approve your own expenses'
        using errcode = '42501';
    end if;
    -- Sole admin: permitted, but recorded as a self-approval.
    self_approval := true;
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
