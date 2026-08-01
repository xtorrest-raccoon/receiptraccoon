-- Lets an owner/admin set a co-member's personal display currency (see
-- 0019_personal_display_prefs.sql) from the Setup page. Deliberately NOT
-- a broadened profiles_update RLS policy -- that would let an admin write
-- any column on a co-member's row (display_name, avatar_url), not just
-- this one preference. A narrow security-definer RPC, same pattern as
-- create_workspace() and accept_workspace_invite(), keeps profiles_update
-- exactly as it was (self-only) and only ever touches display_currency.
--
-- No self-service: the web Profile page is read-only (shows the effective
-- value), and this RPC is the only write path for these two columns.
create or replace function set_user_display_currency(target_user_id uuid, new_currency text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m1.role in ('owner','admin')
      and m2.user_id = target_user_id
  ) then
    raise exception 'Not authorized to set this user''s display currency'
      using errcode = '42501';
  end if;

  update profiles set display_currency = new_currency where id = target_user_id;
end $$;

-- Same reasoning, for the personal distance-unit override.
create or replace function set_user_display_distance_unit(target_user_id uuid, new_unit text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if new_unit is not null and new_unit not in ('mi','km') then
    raise exception 'Invalid distance unit' using errcode = '22023';
  end if;

  if not exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m1.role in ('owner','admin')
      and m2.user_id = target_user_id
  ) then
    raise exception 'Not authorized to set this user''s display distance unit'
      using errcode = '42501';
  end if;

  update profiles set display_distance_unit = new_unit where id = target_user_id;
end $$;
