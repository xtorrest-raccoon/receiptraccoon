-- Organizations: a grouping layer above workspaces, for an admin who
-- administers multiple sites and wants to switch between them under one
-- account. Deliberately does NOT touch billing in this pass -- each
-- workspace keeps its own Stripe columns and bills independently for now.
-- Consolidating billing per-organization is a separate, later migration
-- once this structural layer is in place and working.

create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;

alter table workspaces add column organization_id uuid references organizations(id);

-- Backfill: every existing workspace gets its own organization (same name),
-- so nothing about an existing single-workspace user changes today --
-- they just now have an implicit organization of one workspace.
do $$
declare
  ws record;
  new_org_id uuid;
begin
  for ws in select * from workspaces where organization_id is null loop
    insert into organizations (name) values (ws.name) returning id into new_org_id;
    update workspaces set organization_id = new_org_id where id = ws.id;
  end loop;
end $$;

alter table workspaces alter column organization_id set not null;

-- ═══════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════

create or replace function is_organization_member(org uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members wm
    join workspaces w on w.id = wm.workspace_id
    where w.organization_id = org and wm.user_id = auth.uid()
  );
$$;

create or replace function is_organization_admin(org uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members wm
    join workspaces w on w.id = wm.workspace_id
    where w.organization_id = org and wm.user_id = auth.uid() and wm.role in ('owner','admin')
  );
$$;

create policy organizations_select on organizations for select
  using (is_organization_member(id));

create policy organizations_update on organizations for update
  using (is_organization_admin(id));

-- Creating an additional workspace under an existing organization is a
-- normal authenticated insert now (previously the only way a workspace row
-- came into existence was the handle_new_user trigger, which is security
-- definer and bypasses RLS) -- anyone who administers at least one
-- workspace in that organization can add another one to it. Kept as a
-- defensive policy even though create_workspace() below (the actual path
-- the app uses) bypasses RLS entirely, same reason handle_new_user() does.
create policy workspaces_insert on workspaces for insert
  with check (is_organization_admin(organization_id));

-- ═══════════════════════════════════════════════════════════
-- create_workspace(): a new workspace's very first member is itself,
-- inserted as owner -- but members_write's insert check requires already
-- being an admin of that workspace_id, which is impossible for a workspace
-- with zero rows yet (the same chicken-and-egg handle_new_user's trigger
-- solves for signup). This RPC does both inserts atomically as security
-- definer, after checking the caller actually administers the target
-- organization.
-- ═══════════════════════════════════════════════════════════

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

  insert into workspace_members (workspace_id, user_id, role)
  values (new_ws_id, auth.uid(), 'owner');

  return new_ws_id;
end;
$$;
