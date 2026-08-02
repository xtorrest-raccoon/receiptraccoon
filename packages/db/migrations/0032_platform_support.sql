-- Platform support: a short, hand-maintained allowlist of the people who
-- operate ReceiptRaccoon itself -- deliberately NOT a workspace role;
-- nobody at any customer's company can ever be on this list. Lets a
-- workspace recover when every System Admin is unreachable (left the
-- company, lost their account, whatever) through one narrow, audited
-- action instead of raw SQL improvisation in Supabase Studio.
--
-- No RLS policies on either table below, on purpose -- nobody can read or
-- write them via the client at all, even a platform admin themselves; only
-- the SECURITY DEFINER functions below ever touch them. Add the first
-- platform admin by hand once this migration is applied:
--   insert into platform_admins (user_id) values ('<your own auth.users id>');
create table platform_admins (
  user_id    uuid primary key references profiles on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;

create table platform_recovery_events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces on delete cascade,
  target_user_id  uuid not null references profiles,
  performed_by    uuid not null references profiles,
  action          text not null,
  created_at      timestamptz not null default now()
);
alter table platform_recovery_events enable row level security;

create or replace function is_platform_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- Lists an arbitrary workspace's members for a platform admin to pick a
-- recovery target from -- bypasses is_workspace_member() on purpose, since
-- a platform admin isn't a member of the workspace they're recovering.
-- Reads auth.users directly for email (the one thing profiles doesn't
-- carry) -- safe here since this whole function is gated on
-- is_platform_admin() first.
create or replace function platform_list_workspace_members(p_workspace_id uuid)
returns table (user_id uuid, display_name text, email text, role text)
language plpgsql security definer
set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    select wm.user_id, p.display_name, u.email::text, wm.role
    from workspace_members wm
    join profiles p on p.id = wm.user_id
    join auth.users u on u.id = wm.user_id
    where wm.workspace_id = p_workspace_id
    order by wm.role, p.display_name;
end $$;

-- Promotes an EXISTING member of the target workspace to System Admin,
-- bypassing promote_to_owner()'s "caller must already be an owner" check --
-- that's the whole point of this one: it runs precisely when there are
-- none left who could grant it themselves. Still requires the target to
-- already belong to the workspace (never grants ownership to an outsider)
-- and permanently logs every use.
create or replace function platform_promote_to_owner(p_workspace_id uuid, p_target_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update workspace_members
  set role = 'owner', can_approve_reimbursements = true, can_process_reimbursements = true
  where workspace_id = p_workspace_id and user_id = p_target_user_id;

  if not found then
    raise exception 'That person is not a member of this workspace' using errcode = '22023';
  end if;

  insert into platform_recovery_events (workspace_id, target_user_id, performed_by, action)
  values (p_workspace_id, p_target_user_id, auth.uid(), 'promote_to_owner');
end $$;
