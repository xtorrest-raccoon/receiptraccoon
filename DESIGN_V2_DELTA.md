# Design v2 — what changed, and what it costs

> Read against [BUILD_PLAN.md](BUILD_PLAN.md) and [OCR_PLAN.md](OCR_PLAN.md).
> Source: `Receipt Raccoon Dashboard.zip` re-exported 2026-07-19 (Dashboard 47KB→83KB, Mobile 28KB→57KB).
> Last updated: 2026-07-19

---

## 1. The headline

**v1 design:** a solo freelancer photographs receipts, sees them on a dashboard.
**v2 design:** a company's employees photograph receipts and mileage, and someone approves and
reimburses them.

That's not a feature addition, it's a different product with a different buyer. The centre of
gravity moved from *capture* to *approval workflow*. Almost everything below follows from it.

Worth saying plainly: this is a **bigger build than what I estimated at ~2 weeks**. Three new
subsystems appeared — reimbursement workflow, mileage, and multi-currency FX. Realistic revised
estimate for v0 is **4–5 weeks**, same agent workflow. Nothing here is a bad idea; it's just
more, and I'd rather adjust the number now than discover it in week three.

---

## 2. Web dashboard — changes

| Area | v1 | v2 |
|---|---|---|
| **Nav** | Dashboard · Receipts · Integrations | Dashboard · Receipts · **Team** (Integrations dropped from nav; its data still exists in code) |
| **Logo** | Abstract raccoon shape | New raccoon-face mark |
| **Sidebar** | Snap-a-receipt promo | **+ Home currency selector** (10 currencies) with "Foreign receipts are auto-converted at scan time using the latest rate" |
| **Stat card 1** | Spend this month | Spend this month **(incl. tax)** |
| **Stat card 2** | All-time spend | **Current annual spend to date** (YTD, not all-time) |
| **Stat card 3** | Tax paid this month | **Reimbursable to employees** + pending payout count |
| **Stat card 4** | Receipts this month | unchanged |
| **Health widget** | Fixed score | **Simple / Composite algorithm selector** + per-factor toggles |
| **Receipts table** | Date·Vendor·Category·Payment·Total·Status | Date·Vendor·**User**·Category·Total·**Reimbursement** (dropdown) |
| **Filters** | search + category | **+ user filter** |
| **Receipts page** | — | **+ Manage categories panel** (add/remove custom; removal reassigns receipts to "Other") |
| **Team page** | did not exist | **entirely new** — see below |
| **Receipt drawer** | vendor/date/payment, line items, totals | **+ user, + reimbursement state buttons, + rejection reason, + FX conversion block, + comment** |
| **Modals** | none | **Rejection modal** with a reason "visible to the employee" |

### The new Team page
- Dark banner: **outstanding refund** across all pending + approved receipts, any month
- **Aged >30 days** alert block with count and total
- 4 stats: team spend this month · active users · needs review · highest spender
- **Per-user table**: receipts, outstanding refund, oldest pending (age-colored), top category
- **Mileage reimbursements table**: date, user, purpose, distance, amount, status dropdown

---

## 3. Mobile — changes

- **New Mileage tab** (tabs are now Home · Capture · Receipts · Mileage)
  - mi/km toggle · user-editable rate (defaults $0.70) · manual "Add trip" (purpose, date,
    distance) · trip list with reimbursement status badges
  - **No GPS/auto-detection** — manual entry only. Much cheaper than PLAN.md's auto-detect
    mileage, and the right v0 call.
- **Home**: composite health with factor toggles; home currency
- **Receipts list**: now shows reimbursement status badges per row
- **Confirm screen**: total is now **editable**, and there's a **comment** field
- **Multi-currency**: `FX_TO_HOME` rate table + currency symbols for 10 currencies

---

## 4. Backend consequences

### 4.1 Schema additions to BUILD_PLAN.md §2.1

```sql
-- receipts: reimbursement workflow
alter table receipts add column reimbursement_status text not null default 'pending'
  check (reimbursement_status in ('pending','approved','reimbursed','rejected'));
alter table receipts add column rejection_reason text;
alter table receipts add column rejected_by uuid references profiles;
alter table receipts add column rejected_at timestamptz;
alter table receipts add column approved_by uuid references profiles;
alter table receipts add column approved_at timestamptz;
alter table receipts add column reimbursed_at timestamptz;
alter table receipts add column comment text;              -- employee-entered, not extracted

-- receipts: multi-currency
alter table receipts add column original_currency char(3);   -- what the receipt was printed in
alter table receipts add column original_total_cents bigint;
alter table receipts add column fx_rate numeric(18,8);       -- rate used, frozen at scan time
alter table receipts add column fx_rate_date date;
alter table receipts add column fx_source text;              -- provider, for audit
-- total_cents stays in the workspace's home currency

alter table workspaces add column home_currency char(3) not null default 'USD';
alter table workspaces add column mileage_rate_minor int not null default 70;   -- ¢ per mile
alter table workspaces add column mileage_unit text not null default 'mi' check (mileage_unit in ('mi','km'));

-- mileage
create table mileage_trips (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces on delete cascade,
  user_id       uuid not null references profiles,
  trip_date     date not null,
  purpose       text not null,
  distance      numeric(10,2) not null,
  distance_unit text not null check (distance_unit in ('mi','km')),
  rate_minor    int not null,        -- frozen at entry, like fx_rate
  amount_cents  bigint not null,     -- computed at entry, never recomputed
  reimbursement_status text not null default 'pending'
    check (reimbursement_status in ('pending','approved','reimbursed','rejected')),
  rejection_reason text,
  created_at    timestamptz not null default now()
);
create index on mileage_trips (workspace_id, trip_date desc);
create index on mileage_trips (workspace_id, user_id, reimbursement_status);

-- approvals audit — you will need this the first time someone disputes a rejection
create table reimbursement_events (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('receipt','mileage_trip')),
  entity_id    uuid not null,
  actor        uuid not null references profiles,
  from_status  text,
  to_status    text not null,
  reason       text,
  created_at   timestamptz not null default now()
);
```

**Two design principles applied above, both deliberate:**

- **Freeze rates at write time.** `fx_rate`, `rate_minor`, and `amount_cents` are stored, never
  recomputed. If you recompute FX on read, a receipt's value silently changes months later and
  your reimbursement totals stop reconciling with what was actually paid. Same reason
  `mileage_trips.rate_minor` is per-row rather than read from the workspace.
- **Every status transition is an event.** The design lets you reject a receipt with a reason
  "visible to the employee." The first time an employee disputes that, you need to know who
  changed what and when. A status column alone can't tell you.

### 4.2 New external dependency: an FX rate provider

Not in any previous plan and it needs a decision. "Auto-converted at scan time using the latest
rate" means a daily rates feed.

Options: the ECB's free daily reference feed (free, EUR-based, no key, ~35 currencies, weekdays
only), or a commercial API like OpenExchangeRates or exchangerate.host (paid tiers, more
currencies, historical endpoints).

**Recommendation:** ECB daily feed, cached in a `fx_rates` table, with a nightly refresh job.
Free, authoritative, and auditable. The gap is weekends and holidays — use the most recent prior
rate and store `fx_rate_date` so it's honest about which day's rate was applied. Only move to a
paid provider if you need currencies the ECB doesn't publish.

### 4.3 The dashboard endpoint grows

`/api/dashboard` picks up `reimbursableTotal` + pending count; `/api/team` is new (per-user
aggregates, outstanding refund, aging buckets, mileage totals). Keep the same discipline —
one Postgres function, both clients, no client-side recomputation.

---

## 5. Impact on the OCR work you're doing right now

Mostly small, but **one item is a genuine technical wrinkle**:

### 5.1 Custom categories break the static enum ⚠️

`OCR_PLAN.md` §2 defines `category: z.enum(CATEGORIES)` with a fixed 10. The v2 design lets each
workspace **add and remove categories**. OpenAI strict Structured Outputs requires the enum to be
fixed **in the request** — so you can't have one static schema any more.

Fix: build the JSON schema **per workspace, per call**, from that workspace's current category
list. Cheap to do, but it means the extraction schema is no longer a compile-time constant, and
the Zod type becomes `z.string()` with runtime validation against the workspace's set. Worth
knowing before the code is written rather than after.

```ts
function buildSchema(workspaceCategories: string[]) { /* enum injected at call time */ }
```

Note this also kills prompt caching on the schema portion for multi-workspace traffic, since the
prefix differs per workspace. Immaterial at your volume (§1 of OCR_PLAN said caching probably
wouldn't engage anyway), but it's the reason not to fight for it.

### 5.2 Currency detection becomes load-bearing

`currency` was a nice-to-have field. Now it drives FX conversion, which drives reimbursement
amounts. A misread currency means someone gets paid the wrong amount.

Add to the eval harness in OCR_PLAN §8: **currency accuracy, target ≥98%**, and put foreign
receipts in the corpus deliberately — at least 20 of the 200.

> **Revised 2026-07-19.** I originally specified: route any non-home currency to
> `needs_review` regardless of confidence. That was wrong once we established the user is
> euro-based *and travels*. Foreign receipts are a normal path, not an edge case, and a
> week abroad would dump thirty receipts into manual review — recreating the tedium the
> product exists to remove.
>
> Now: foreign currency is a **soft** flag. It converts automatically and shows the FX line
> the design already includes in the receipt drawer. The guard against a *misread* currency
> is the confidence score — `currency` is one of the weakest-link critical fields, so low
> certainty already pulls the receipt into review on its own merits. What still needs a hard
> guard is conversion time: refuse to convert when no FX rate exists for that date rather
> than silently falling back to a nearby one.

### 5.3 Smaller items

- **`comment` is user-entered, not extracted** — it must not appear in the extraction schema.
- **Editable total on the mobile Confirm screen** — every edit writes to `receipt_edits`
  (already in the schema). This is your highest-value eval signal: a human correcting the total
  is a labeled failure. Log it deliberately.
- **`payment_method` disappeared from the web receipts table** but is still in the receipt
  drawer, so keep extracting it.

---

## 6. Open questions this design created

1. ✅ **RESOLVED — who can approve reimbursements?** Admins only. Full model in §9.

2. ✅ **RESOLVED — job title vs permission role.** Both fields, split. See §9.

3. **The Simple/Composite health selector should not ship.** It's a great design-review
   affordance for choosing between two algorithms, but shipping a user-facing "which scoring
   algorithm do you prefer" control undermines the number's credibility. Pick one — I'd take
   **Composite**, and note the design's version is better than the formula I proposed in
   BUILD_PLAN §2.6, because it drops the self-serving engagement factor I flagged. Consider the
   factor toggles a debug view; keep them behind an admin flag if you want them.

4. **Category deletion is destructive.** Removing a category silently reassigns every receipt to
   "Other" with no undo. At minimum: a confirmation showing the affected count. Better: soft
   delete (`archived_at`) so history stays intact and the change is reversible.

5. **FX timing.** Locked at scan time per the sidebar copy — which I agree with and have built
   into the schema. Confirming because it means a reimbursement approved 60 days later pays the
   scan-date rate, and someone will eventually ask why.

6. **Does mileage need receipts/evidence?** Currently pure self-report. Fine for a small team,
   a problem at audit. Not a v0 blocker.

---

## 7. Revised estimate

| Phase | v1 estimate | v2 estimate |
|---|---|---|
| 0 · Foundation | 1 day | 2 days (bigger schema, FX, RLS/authorization rules) |
| 1 · Parallel build | 1 week | 2.5 weeks (Team page, mileage, reimbursement, FX are all new) |
| 2 · Review gates | 2 days | 3 days (authorization logic needs real scrutiny) |
| 3 · Integration | 2 days | 3 days |
| **v0 on your phone** | ~2 weeks | **~4–5 weeks** |

The agent workflow from BUILD_PLAN §4 is unchanged and gets *more* valuable here — Team page,
mileage, and reimbursement UI are three genuinely independent tracks. But the **authorization
rules go to Opus, not Sonnet**: "who can approve what" is exactly the kind of logic where a
plausible-looking wrong answer is expensive.

---

## 8. Still outstanding from before

**Node is not installed** — `winget install OpenJS.NodeJS.LTS`, then reopen your terminal and
`corepack enable`. Nothing can be built until this is done.

**The 200-receipt corpus** is now more important, not less, because §5.2 added currency accuracy
to what it has to prove. Include foreign-currency receipts.

---

## 9. Authorization model (decided 2026-07-19)

**Decision: only admins can approve reimbursements.**

### 9.1 Two separate fields

Permission role and job title are different things and must not share a column:

```sql
alter table workspace_members
  add column job_title text;                    -- "Sales Manager" — display only, free text

-- role stays constrained; it is the ONLY thing access control reads
--   role in ('owner','admin','member')
```

The design's *Owner · Sales Manager · Office Manager · Field Technician* are job titles. Xavier
is `role='owner'`; the other three are `role='member'` unless you promote them. `owner` is
`admin` plus billing and the ability to delete the workspace.

### 9.2 Permission matrix

| Action | member | admin | owner |
|---|:--:|:--:|:--:|
| Upload receipt, log mileage | ✅ | ✅ | ✅ |
| View / edit **own** receipts | ✅ | ✅ | ✅ |
| View **everyone's** receipts + Team page | ❌ | ✅ | ✅ |
| Edit someone else's receipt fields | ❌ | ✅ | ✅ |
| **Change reimbursement status** | ❌ | ✅ | ✅ |
| Approve **own** receipt | ❌ | ⚠️ see 9.3 | ⚠️ |
| Manage categories, mileage rate, home currency | ❌ | ✅ | ✅ |
| Invite / remove members, change roles | ❌ | ✅ | ✅ |
| Billing, delete workspace | ❌ | ❌ | ✅ |

Note the member row: a member **cannot see the Team page at all**. In the current design the
Team page is a top-level nav item — it needs to be hidden for members, and the API must enforce
that independently of the UI.

### 9.3 Self-approval

You said admins approve, which leaves one case the design doesn't cover: **can an admin approve
their own expense?** Strictly blocking it breaks the solo owner — a one-person business could
never reimburse itself, which is a real and common case.

**Proposed rule, implemented unless you say otherwise:**

> An admin may not approve their own receipt **if the workspace has ≥2 admins**.
> In a single-admin workspace, self-approval is permitted and recorded as such.

That gives separation of duties wherever it's actually achievable, without bricking the
one-person case. Every self-approval writes to `reimbursement_events` with the actor, so it's
visible in an audit either way. Say the word if you'd rather always allow or always block.

### 9.4 RLS policies

```sql
create or replace function is_workspace_admin(ws uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

-- READ: members see only their own; admins see the whole workspace
create policy receipts_select on receipts for select using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  and (created_by = auth.uid() or is_workspace_admin(workspace_id))
);

-- INSERT: anyone in the workspace, only as themselves
create policy receipts_insert on receipts for insert with check (
  created_by = auth.uid()
  and workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);

-- UPDATE: own receipts, or any receipt if admin
create policy receipts_update on receipts for update using (
  created_by = auth.uid() or is_workspace_admin(workspace_id)
);
```

RLS alone can't express "members may edit their own receipt but not its
`reimbursement_status`" — column-level rules don't fit cleanly in a row policy. Enforce that
with a **trigger**, so it holds no matter which client writes:

```sql
create or replace function enforce_reimbursement_authority()
returns trigger language plpgsql as $$
declare admin_count int;
begin
  if new.reimbursement_status is distinct from old.reimbursement_status then
    if not is_workspace_admin(new.workspace_id) then
      raise exception 'only admins can change reimbursement status';
    end if;

    if new.created_by = auth.uid() and new.reimbursement_status in ('approved','reimbursed') then
      select count(*) into admin_count from workspace_members
        where workspace_id = new.workspace_id and role in ('owner','admin');
      if admin_count >= 2 then
        raise exception 'admins cannot approve their own receipts when another admin exists';
      end if;
    end if;

    insert into reimbursement_events (entity_type, entity_id, actor, from_status, to_status, reason)
    values ('receipt', new.id, auth.uid(), old.reimbursement_status, new.reimbursement_status,
            new.rejection_reason);
  end if;
  return new;
end $$;

create trigger trg_reimbursement_authority
  before update on receipts
  for each row execute function enforce_reimbursement_authority();
```

Same trigger shape on `mileage_trips`.

**Why a trigger rather than API-layer checks:** the mobile app, the web app, and any future
integration all write through the same database. A check in a Next.js route handler protects
exactly one path. This protects all of them, including the ones that don't exist yet — and
reimbursement authority is precisely the rule you don't want depending on which client happened
to make the call.

### 9.5 Consequences for the UI

- **Team nav item**: hidden for members
- **Reimbursement dropdown** in the receipts table: read-only badge for members
- **Rejection modal**: admin-only
- **Mobile**: members see their own status as a badge; no controls
- **`/api/team`**: returns 403 for members — never rely on nav hiding as the enforcement

### 9.6 Still to decide (not blocking)

- Should admins get a notification when something is pending approval >N days? The design's
  "aged >30 days" block implies yes eventually.
- Can a rejected receipt be resubmitted by the employee, or is rejection terminal? I've assumed
  resubmittable — `rejected → pending` is a legal transition in the trigger above.
