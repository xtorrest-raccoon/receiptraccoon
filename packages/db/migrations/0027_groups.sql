-- Named groups within a workspace (e.g. "Sales team") purely for organizing
-- people -- no authority or reimbursement semantics of their own, unlike
-- security groups (0007_reimbursement_authority.sql). Membership is a plain
-- many-to-many join, same shape as reimbursement_assignments.
create table groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table group_members (
  group_id uuid not null references groups on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (group_id, user_id)
);

alter table groups enable row level security;
alter table group_members enable row level security;

create policy groups_select on groups for select using (is_workspace_member(workspace_id));
create policy groups_write on groups for all
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

create policy group_members_select on group_members for select using (
  exists (select 1 from groups g where g.id = group_members.group_id and is_workspace_member(g.workspace_id))
);
create policy group_members_write on group_members for all
  using (exists (select 1 from groups g where g.id = group_members.group_id and is_workspace_admin(g.workspace_id)))
  with check (exists (select 1 from groups g where g.id = group_members.group_id and is_workspace_admin(g.workspace_id)));
