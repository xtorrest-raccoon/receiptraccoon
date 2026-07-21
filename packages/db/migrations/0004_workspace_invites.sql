-- Invite teammates into a shared workspace.
--
-- Every signup gets its own solo workspace via handle_new_user() (see
-- 0001_init.sql) — there is no way today to add someone else into *your*
-- workspace. This migration adds a pending-invite table plus a
-- security-definer accept function that migrates the accepting user (and
-- their own receipts/mileage trips) from whatever workspace they're
-- currently in onto the inviter's workspace. Works identically whether the
-- invite is accepted seconds after signup or, as with the first real case
-- that surfaced this, days into using their own separate workspace already —
-- handle_new_user() itself is untouched.

create table workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  email        text not null,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  invited_by   uuid not null references profiles,
  status       text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);

-- One pending invite per (workspace, email) at a time — resending means
-- revoking the old one first.
create unique index workspace_invites_pending_uq
  on workspace_invites (workspace_id, lower(email))
  where status = 'pending';

create index on workspace_invites (lower(email)) where status = 'pending';

alter table workspace_invites enable row level security;

create policy invites_select on workspace_invites for select using (
  is_workspace_admin(workspace_id) or lower(email) = lower(auth.email())
);

-- Sending and revoking both go through a plain admin-gated insert/update —
-- accepting does NOT (see accept_workspace_invite below), since the
-- accepting user isn't a workspace admin of the workspace they're joining.
create policy invites_insert on workspace_invites for insert with check (
  is_workspace_admin(workspace_id)
);

create policy invites_update on workspace_invites for update using (
  is_workspace_admin(workspace_id)
) with check (
  is_workspace_admin(workspace_id)
);

-- ═══════════════════════════════════════════════════════════
-- accept
-- ═══════════════════════════════════════════════════════════

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
    -- Move the caller's own receipts, remapping category by name (a
    -- workspace's categories are its own rows, never shared) — falls back to
    -- the destination workspace's "Other" the same way removeCategoryName()
    -- already does for a deleted category. A receipt with no category stays
    -- uncategorized rather than being forced into "Other".
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

    -- Receipt photos need no change here: storage visibility follows the
    -- receipt's current workspace via receipts_bucket_select_via_receipt
    -- below, not the object's folder prefix, so nothing needs physically
    -- moving in Storage.

    update mileage_trips m
    set workspace_id = v_new_ws
    where m.user_id = v_caller and m.workspace_id = v_old_ws;

    delete from workspace_members where workspace_id = v_old_ws and user_id = v_caller;

    insert into workspace_members (workspace_id, user_id, role)
    values (v_new_ws, v_caller, v_invite.role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  end if;

  update workspace_invites set status = 'accepted', accepted_at = now() where id = p_invite_id;
end;
$$;

grant execute on function accept_workspace_invite(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- photo visibility follows the receipt, not the folder
-- ═══════════════════════════════════════════════════════════

-- Additional permissive SELECT policy (OR'd with 0003's folder-based one): a
-- receipt migrated into a different workspace by accept_workspace_invite()
-- keeps its photo visible to that workspace's members even though the
-- object's path still starts with the old workspace id — access is derived
-- from the receipt's current workspace_id instead of the object's own path.
create policy receipts_bucket_select_via_receipt on storage.objects for select using (
  bucket_id = 'receipts' and exists (
    select 1 from receipts r
    where r.image_path = storage.objects.name
      and is_workspace_member(r.workspace_id)
  )
);
