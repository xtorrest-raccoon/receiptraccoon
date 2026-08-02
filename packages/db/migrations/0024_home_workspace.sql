-- A person can belong to multiple workspaces (an owner administering more
-- than one site, via create_workspace()) but must only be able to CLAIM
-- expenses in one of them -- their "home" workspace, the one they were
-- originally created in. Administering/toggling into a second workspace
-- must not let them submit receipts or mileage there too.
--
-- home_workspace_id is nullable so it degrades safely (see the RLS
-- policies below, which fall back to the old is_workspace_member check
-- when it's unset) -- but backfilled here for every existing profile so
-- it's never actually null in practice.
alter table profiles add column home_workspace_id uuid references workspaces on delete set null;

-- Backfill: earliest membership (by created_at) becomes each person's home.
update profiles p
set home_workspace_id = sub.workspace_id
from (
  select distinct on (user_id) user_id, workspace_id
  from workspace_members
  order by user_id, created_at asc
) sub
where sub.user_id = p.id and p.home_workspace_id is null;

-- ═══════════════════════════════════════════════════════════
-- handle_new_user(): also fixes a latent bug from 0017_organizations.sql --
-- workspaces.organization_id is NOT NULL, but this trigger was never
-- updated to supply one, so every signup since that migration was applied
-- would have failed outright. Now creates a one-workspace organization for
-- the new signup (same "backfill" shape 0017 used for existing workspaces)
-- and sets their home_workspace_id to it.
-- ═══════════════════════════════════════════════════════════
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

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  update profiles set home_workspace_id = ws_id where id = new.id;

  for i in 1 .. array_length(seed, 1) loop
    insert into categories (workspace_id, name, hue, sort_order, is_system)
    values (ws_id, seed[i], hues[i], i, true);
  end loop;

  return new;
end $$;

-- ═══════════════════════════════════════════════════════════
-- accept_workspace_invite(): keep home_workspace_id pointing at whichever
-- workspace is now the caller's (only) membership after the move, same
-- reasoning as the rest of this function's "one workspace per invited
-- member" model.
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

    insert into workspace_members (workspace_id, user_id, role)
    values (v_new_ws, v_caller, v_invite.role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;

    update profiles set home_workspace_id = v_new_ws where id = v_caller;
  end if;

  update workspace_invites set status = 'accepted', accepted_at = now() where id = p_invite_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- Tighten receipt/mileage submission to the caller's home workspace only.
-- Falls back to the old is_workspace_member check when home_workspace_id
-- is unset (should never happen after the backfill above, but a null
-- home_workspace_id must never silently block someone entirely).
-- ═══════════════════════════════════════════════════════════
drop policy receipts_insert on receipts;
create policy receipts_insert on receipts for insert with check (
  created_by = auth.uid()
  and is_workspace_member(workspace_id)
  and (
    workspace_id = (select home_workspace_id from profiles where id = auth.uid())
    or (select home_workspace_id from profiles where id = auth.uid()) is null
  )
);

drop policy mileage_insert on mileage_trips;
create policy mileage_insert on mileage_trips for insert with check (
  user_id = auth.uid()
  and is_workspace_member(workspace_id)
  and (
    workspace_id = (select home_workspace_id from profiles where id = auth.uid())
    or (select home_workspace_id from profiles where id = auth.uid()) is null
  )
);
