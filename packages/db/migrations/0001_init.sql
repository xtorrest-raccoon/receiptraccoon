-- ReceiptRaccoon — initial schema
-- Reflects design v2 (team expense management with reimbursement workflow).
-- See BUILD_PLAN.md §2.1 and DESIGN_V2_DELTA.md §4.1, §9.

create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════════════════
-- identity & tenancy
-- ═══════════════════════════════════════════════════════════

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table workspaces (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  home_currency      char(3) not null default 'USD',
  mileage_rate_minor int not null default 70,          -- minor units per mile
  mileage_unit       text not null default 'mi' check (mileage_unit in ('mi','km')),
  created_at         timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces on delete cascade,
  user_id      uuid not null references profiles on delete cascade,
  -- Permission role. The ONLY column access control reads.
  role         text not null default 'member' check (role in ('owner','admin','member')),
  -- Display only: "Sales Manager", "Field Technician". Never read by authz.
  job_title    text,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index on workspace_members (user_id);

-- ═══════════════════════════════════════════════════════════
-- categories
-- ═══════════════════════════════════════════════════════════

create table categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name         text not null,
  hue          int not null default 250,
  sort_order   int not null default 0,
  is_system    boolean not null default false,
  -- Soft delete. Removing a category reassigns receipts to "Other"; archiving keeps
  -- history intact and makes the action reversible. See DESIGN_V2_DELTA.md §6.4.
  archived_at  timestamptz,
  unique (workspace_id, name)
);

create index on categories (workspace_id) where archived_at is null;

-- ═══════════════════════════════════════════════════════════
-- receipts
-- ═══════════════════════════════════════════════════════════

create type receipt_status as enum
  ('uploading','processing','needs_review','processed','failed');

create type reimbursement_status as enum
  ('pending','approved','reimbursed','rejected');

create table receipts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces on delete cascade,
  created_by        uuid not null references profiles,
  status            receipt_status not null default 'uploading',

  image_path        text,
  image_sha256      text,
  source            text not null default 'mobile_camera',

  vendor            text,
  vendor_normalized text generated always as
                      (lower(regexp_replace(coalesce(vendor,''), '[^a-zA-Z0-9]', '', 'g'))) stored,
  receipt_date      date,
  category_id       uuid references categories on delete set null,

  -- Home-currency amounts. All reporting reads these.
  currency          char(3) not null default 'USD',
  subtotal_minor    bigint,
  tax_minor         bigint,
  total_minor       bigint generated always as
                      (coalesce(subtotal_minor,0) + coalesce(tax_minor,0)) stored,

  -- Populated only for foreign-currency receipts. Rate frozen at scan time so a
  -- receipt's home-currency value never drifts. DESIGN_V2_DELTA.md §4.1.
  original_currency     char(3),
  original_total_minor  bigint,
  fx_rate               numeric(18,8),
  fx_rate_date          date,
  fx_source             text,

  payment_brand     text,
  -- Not always four digits. Real receipts mask cards as "XX19", "**1234", or print
  -- only the final two. A stricter constraint rejected live French toll receipts
  -- during first testing.
  payment_last4     text check (payment_last4 ~ '^[0-9Xx*•#]{2,8}$'),
  payment_type      text check (payment_type in ('credit','debit','cash','other')),

  comment           text,          -- employee-entered, never extracted

  reimbursement_status reimbursement_status not null default 'pending',
  rejection_reason  text,
  approved_by       uuid references profiles,
  approved_at       timestamptz,
  rejected_by       uuid references profiles,
  rejected_at       timestamptz,
  reimbursed_at     timestamptz,

  extraction_confidence numeric(3,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on receipts (workspace_id, receipt_date desc);
create index on receipts (workspace_id, status);
create index on receipts (workspace_id, reimbursement_status);
create index on receipts (workspace_id, created_by);
create index on receipts (workspace_id, category_id);
create index on receipts (workspace_id, vendor_normalized);
create unique index on receipts (workspace_id, image_sha256) where image_sha256 is not null;

create table receipt_line_items (
  id               uuid primary key default gen_random_uuid(),
  receipt_id       uuid not null references receipts on delete cascade,
  description      text not null,
  quantity         numeric(10,2) not null default 1,
  unit_price_minor bigint not null,
  amount_minor     bigint generated always as (round(quantity * unit_price_minor)) stored,
  sort_order       int not null default 0
);

create index on receipt_line_items (receipt_id);

-- ═══════════════════════════════════════════════════════════
-- mileage
-- ═══════════════════════════════════════════════════════════

create table mileage_trips (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces on delete cascade,
  user_id       uuid not null references profiles,
  trip_date     date not null,
  purpose       text not null,
  distance      numeric(10,2) not null check (distance > 0),
  distance_unit text not null check (distance_unit in ('mi','km')),
  -- Frozen at entry, like fx_rate. Changing the workspace rate must not silently
  -- restate what someone is already owed.
  rate_minor    int not null,
  amount_minor  bigint not null,
  reimbursement_status reimbursement_status not null default 'pending',
  rejection_reason text,
  created_at    timestamptz not null default now()
);

create index on mileage_trips (workspace_id, trip_date desc);
create index on mileage_trips (workspace_id, user_id, reimbursement_status);

-- ═══════════════════════════════════════════════════════════
-- audit trails
-- ═══════════════════════════════════════════════════════════

-- Append-only. Audit trail for tax defensibility, labeled eval set for improving
-- the prompt, and per-receipt cost visibility. BUILD_PLAN.md §2.1.
create table extractions (
  id                 uuid primary key default gen_random_uuid(),
  receipt_id         uuid not null references receipts on delete cascade,
  provider           text not null,
  model              text not null,
  raw_response       jsonb not null,
  field_confidence   jsonb not null,
  overall_confidence numeric(3,2) not null,
  input_tokens       int,
  output_tokens      int,
  cost_minor         numeric(10,4),
  duration_ms        int,
  created_at         timestamptz not null default now()
);

create index on extractions (receipt_id, created_at desc);

-- Every human correction is a labeled extraction failure. Log it deliberately.
create table receipt_edits (
  id         uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts on delete cascade,
  edited_by  uuid not null references profiles,
  field      text not null,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);

create index on receipt_edits (receipt_id);

create table reimbursement_events (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('receipt','mileage_trip')),
  entity_id   uuid not null,
  actor       uuid not null references profiles,
  from_status reimbursement_status,
  to_status   reimbursement_status not null,
  reason      text,
  -- True when an admin approved their own expense (only legal as sole admin).
  was_self_approval boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on reimbursement_events (entity_type, entity_id, created_at desc);

-- ═══════════════════════════════════════════════════════════
-- fx rates
-- ═══════════════════════════════════════════════════════════

create table fx_rates (
  rate_date  date not null,
  base       char(3) not null,
  quote      char(3) not null,
  rate       numeric(18,8) not null,
  source     text not null,
  primary key (rate_date, base, quote)
);

-- ═══════════════════════════════════════════════════════════
-- helpers
-- ═══════════════════════════════════════════════════════════

create or replace function is_workspace_member(ws uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function is_workspace_admin(ws uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

create or replace function workspace_admin_count(ws uuid)
returns int language sql security definer stable
set search_path = public as $$
  select count(*)::int from workspace_members
  where workspace_id = ws and role in ('owner','admin');
$$;

-- ═══════════════════════════════════════════════════════════
-- reimbursement authority
--
-- Enforced as a trigger rather than in an API route: mobile, web, and any future
-- integration all write to this database. A check in one route handler protects one
-- path; this protects every path, including ones that do not exist yet.
-- DESIGN_V2_DELTA.md §9.4.
-- ═══════════════════════════════════════════════════════════

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

  owner_id := case tg_argv[0] when 'receipt' then new.created_by else new.user_id end;

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

create trigger trg_receipt_reimbursement_authority
  before update on receipts
  for each row execute function enforce_reimbursement_authority('receipt');

create trigger trg_mileage_reimbursement_authority
  before update on mileage_trips
  for each row execute function enforce_reimbursement_authority('mileage_trip');

-- ═══════════════════════════════════════════════════════════
-- row level security
--
-- The mobile app ships the anon key inside its binary, where anyone who downloads
-- the app can extract it. RLS is the only thing between that key and everyone's
-- receipts. Enabled on every table, no exceptions.
-- ═══════════════════════════════════════════════════════════

alter table profiles            enable row level security;
alter table workspaces          enable row level security;
alter table workspace_members   enable row level security;
alter table categories          enable row level security;
alter table receipts            enable row level security;
alter table receipt_line_items  enable row level security;
alter table mileage_trips       enable row level security;
alter table extractions         enable row level security;
alter table receipt_edits       enable row level security;
alter table reimbursement_events enable row level security;
alter table fx_rates            enable row level security;

-- profiles: visible to workspace co-members
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
create policy profiles_update on profiles for update using (id = auth.uid());

-- workspaces
create policy workspaces_select on workspaces for select
  using (is_workspace_member(id));
create policy workspaces_update on workspaces for update
  using (is_workspace_admin(id));

-- members
create policy members_select on workspace_members for select
  using (is_workspace_member(workspace_id));
create policy members_write on workspace_members for all
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

-- categories
create policy categories_select on categories for select
  using (is_workspace_member(workspace_id));
create policy categories_write on categories for all
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

-- receipts: members see only their own; admins see the whole workspace
create policy receipts_select on receipts for select using (
  is_workspace_member(workspace_id)
  and (created_by = auth.uid() or is_workspace_admin(workspace_id))
);

create policy receipts_insert on receipts for insert with check (
  created_by = auth.uid() and is_workspace_member(workspace_id)
);

create policy receipts_update on receipts for update using (
  created_by = auth.uid() or is_workspace_admin(workspace_id)
);

create policy receipts_delete on receipts for delete using (
  created_by = auth.uid() or is_workspace_admin(workspace_id)
);

-- line items follow their receipt
create policy line_items_select on receipt_line_items for select using (
  exists (select 1 from receipts r where r.id = receipt_id)
);
create policy line_items_write on receipt_line_items for all using (
  exists (select 1 from receipts r where r.id = receipt_id)
);

-- mileage: same shape as receipts
create policy mileage_select on mileage_trips for select using (
  is_workspace_member(workspace_id)
  and (user_id = auth.uid() or is_workspace_admin(workspace_id))
);
create policy mileage_insert on mileage_trips for insert with check (
  user_id = auth.uid() and is_workspace_member(workspace_id)
);
create policy mileage_update on mileage_trips for update using (
  user_id = auth.uid() or is_workspace_admin(workspace_id)
);

-- audit tables: readable by those who can read the parent receipt, never writable
-- from a client (jobs write with the service role, which bypasses RLS).
create policy extractions_select on extractions for select using (
  exists (select 1 from receipts r where r.id = receipt_id)
);
create policy edits_select on receipt_edits for select using (
  exists (select 1 from receipts r where r.id = receipt_id)
);
create policy events_select on reimbursement_events for select using (
  case entity_type
    when 'receipt' then exists (select 1 from receipts r where r.id = entity_id)
    else exists (select 1 from mileage_trips t where t.id = entity_id)
  end
);

-- fx rates: reference data, readable by any authenticated user
create policy fx_select on fx_rates for select to authenticated using (true);

-- ═══════════════════════════════════════════════════════════
-- new-user bootstrap
-- ═══════════════════════════════════════════════════════════

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  ws_id uuid;
  seed  text[] := array['Meals','Groceries','Travel','Office Supplies','Software',
                        'Fuel','Utilities','Marketing','Professional Services','Other'];
  hues  int[]  := array[40,150,230,285,262,22,195,340,305,250];
  i     int;
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  insert into workspaces (name) values ('My Workspace') returning id into ws_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  for i in 1 .. array_length(seed, 1) loop
    insert into categories (workspace_id, name, hue, sort_order, is_system)
    values (ws_id, seed[i], hues[i], i, true);
  end loop;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
