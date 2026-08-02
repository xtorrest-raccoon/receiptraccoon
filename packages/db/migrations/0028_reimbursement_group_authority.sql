-- "Authority on" now scopes an approver/refunder to whole groups (see
-- 0027_groups.sql) rather than picking individual people one at a time --
-- assigning "Sales team" automatically covers whoever is a member of that
-- group at the time of the check, no re-assignment needed as membership
-- changes. Replaces the per-employee reimbursement_assignments entirely;
-- no data worth preserving there yet (this workspace's only row was test
-- data from before this feature existed).
create table reimbursement_group_assignments (
  workspace_id uuid not null references workspaces on delete cascade,
  approver_id  uuid not null references profiles on delete cascade,
  group_id     uuid not null references groups on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (approver_id, group_id)
);

alter table reimbursement_group_assignments enable row level security;

create policy group_assignments_select on reimbursement_group_assignments for select using (
  is_workspace_member(workspace_id)
);
-- Same audience as who can grant the underlying capability -- see
-- can_grant_reimbursement_authority() in 0007.
create policy group_assignments_write on reimbursement_group_assignments for all using (
  can_grant_reimbursement_authority(workspace_id)
) with check (
  can_grant_reimbursement_authority(workspace_id)
);

-- ═══════════════════════════════════════════════════════════
-- authority checks, now group-aware instead of employee-aware. Same
-- signatures as 0009_reimbursement_assignments.sql -- create or replace
-- means every RLS policy and the trigger that already reference these by
-- name pick up the new logic with no further changes needed.
-- ═══════════════════════════════════════════════════════════

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
          select 1
          from reimbursement_group_assignments rga
          join group_members gm on gm.group_id = rga.group_id
          where rga.approver_id = auth.uid() and gm.user_id = target_user
        )
      )
  );
$$;

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
          select 1
          from reimbursement_group_assignments rga
          join group_members gm on gm.group_id = rga.group_id
          where rga.approver_id = wm.user_id and gm.user_id = target_user
        )
      )
  );
$$;

drop policy if exists assignments_select on reimbursement_assignments;
drop policy if exists assignments_write on reimbursement_assignments;
drop table if exists reimbursement_assignments;
