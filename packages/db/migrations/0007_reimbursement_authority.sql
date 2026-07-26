-- Split "can change reimbursement status" out of role (owner/admin/member)
-- into its own axis. role still gates workspace administration (settings,
-- invites, member management); these two columns gate reimbursement
-- decisions specifically, independently of role, since a plain member can
-- now be granted authority without becoming an admin.
--
-- Two independent booleans rather than one "authority level" enum: approve
-- and refund are separate real-world duties (segregation of duties is the
-- whole point) — someone can hold either, both, or neither.
alter table workspace_members
  add column can_approve_reimbursements boolean not null default false,
  add column can_process_reimbursements boolean not null default false;

-- Preserve current behavior exactly: every existing owner/admin already had
-- full authority under the old is_workspace_admin() check, so they keep it
-- here rather than losing it silently on deploy. New admins going forward do
-- NOT get this automatically — see can_grant_reimbursement_authority below,
-- authority is granted explicitly from now on.
update workspace_members
set can_approve_reimbursements = true, can_process_reimbursements = true
where role in ('owner', 'admin');

-- ═══════════════════════════════════════════════════════════
-- authority checks
-- ═══════════════════════════════════════════════════════════

-- Does anyone ELSE in this workspace hold this specific capability? Used for
-- the self-approval exception below — without this, a workspace where the
-- only capable person submits their own expense would deadlock forever.
create or replace function has_other_reimbursement_authority(ws uuid, capability text, exclude_user uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws
      and user_id != exclude_user
      and (
        (capability = 'approve' and can_approve_reimbursements)
        or (capability = 'process' and can_process_reimbursements)
      )
  );
$$;

-- Who can grant/revoke reimbursement authority for someone else. Deliberately
-- narrower than "anyone with can_process_reimbursements" — a refund-only
-- holder granting themselves approval too would let them silently become a
-- full super user by their own hand, defeating the segregation of duties this
-- whole feature exists for. Only owner/admin (existing workspace authority)
-- or someone who ALREADY holds both capabilities can grant.
create or replace function can_grant_reimbursement_authority(ws uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and (role in ('owner', 'admin') or (can_approve_reimbursements and can_process_reimbursements))
  );
$$;

-- Dedicated RPC rather than letting the client update workspace_members
-- directly: that table's row-level RLS write policy is role-gated (owner/
-- admin) for good reason — it also covers role and job_title changes, which
-- must stay owner/admin-only. This function is SECURITY DEFINER specifically
-- so a super user (a plain member) can grant/revoke these two columns
-- without also being handed the ability to change anyone's role.
create or replace function grant_reimbursement_authority(
  p_workspace_id uuid,
  p_user_id uuid,
  p_can_approve boolean,
  p_can_process boolean
)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not can_grant_reimbursement_authority(p_workspace_id) then
    raise exception 'You do not have permission to grant reimbursement authority'
      using errcode = '42501';
  end if;

  update workspace_members
  set can_approve_reimbursements = p_can_approve,
      can_process_reimbursements = p_can_process
  where workspace_id = p_workspace_id and user_id = p_user_id;
end $$;

-- ═══════════════════════════════════════════════════════════
-- reimbursement_authority trigger: now reads the two columns above instead
-- of role. approve/reject/back-to-pending need can_approve_reimbursements;
-- only the final payout (-> reimbursed) needs can_process_reimbursements.
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

  owner_id := case tg_argv[0] when 'receipt' then new.created_by else new.user_id end;

  if owner_id = auth.uid()
     and new.reimbursement_status in ('approved','reimbursed') then
    if has_other_reimbursement_authority(new.workspace_id, required_capability, auth.uid()) then
      raise exception 'Someone else with authority must handle your own expenses'
        using errcode = '42501';
    end if;
    -- Sole capable person: permitted, but recorded as a self-approval.
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

-- ═══════════════════════════════════════════════════════════
-- RLS: receipts/mileage select+update were admin-only for anyone but the
-- owner. A granted approver/processor who isn't admin/owner needs to read
-- (and act on) other members' rows too, or the trigger above would allow
-- their write while RLS silently blocks them from ever reaching it.
--
-- Delete stays admin-only on purpose — approve/process authority is about
-- reimbursement decisions, not about being able to destroy someone else's
-- record outright.
-- ═══════════════════════════════════════════════════════════

create or replace function has_reimbursement_authority(ws uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and (can_approve_reimbursements or can_process_reimbursements)
  );
$$;

drop policy receipts_select on receipts;
create policy receipts_select on receipts for select using (
  is_workspace_member(workspace_id)
  and (created_by = auth.uid() or is_workspace_admin(workspace_id) or has_reimbursement_authority(workspace_id))
);

drop policy receipts_update on receipts;
create policy receipts_update on receipts for update using (
  created_by = auth.uid() or is_workspace_admin(workspace_id) or has_reimbursement_authority(workspace_id)
);

drop policy mileage_select on mileage_trips;
create policy mileage_select on mileage_trips for select using (
  is_workspace_member(workspace_id)
  and (user_id = auth.uid() or is_workspace_admin(workspace_id) or has_reimbursement_authority(workspace_id))
);

drop policy mileage_update on mileage_trips;
create policy mileage_update on mileage_trips for update using (
  user_id = auth.uid() or is_workspace_admin(workspace_id) or has_reimbursement_authority(workspace_id)
);
