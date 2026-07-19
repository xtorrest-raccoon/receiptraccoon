# ReceiptRaccoon — Build Plan (Backend, Stack, Agent Workflow)

> Companion to [PLAN.md](PLAN.md). PLAN.md is the *product roadmap*; this is the *build plan* for
> what the Claude Design mockups actually specify.
> Last updated: 2026-07-18

---

## 0. Two corrections to PLAN.md, up front

### 0.1 You're on Windows — native Swift is off the table

PLAN.md recommended native Swift/SwiftUI for iOS. That was written before I knew your
environment. **You're on Windows 11. Xcode doesn't exist on Windows**, so you cannot build,
sign, or ship a native Swift app from this machine, and you also said you want to preview on
your phone — which native Swift makes painful without a Mac.

**Revised recommendation: React Native + Expo, with EAS Build for cloud iOS builds.**
Expo compiles your iOS binary on Apple hardware in Expo's cloud and pushes it to TestFlight.
You never touch a Mac. And Expo Go gives you exactly the phone preview you asked for: run one
command, scan a QR code, the app is on your iPhone in ~20 seconds with hot reload.

The tradeoff is real but acceptable: you lose VisionKit's excellent built-in document scanner.
The mitigation is in §3.3 — and honestly, RN also buys you code sharing with the web app,
which matters more now that I've seen how much logic the two designs have in common.

### 0.2 The design is a much smaller product than PLAN.md

The mockups are a tight MVP, and that's a good thing. What's actually designed:

| | Web (`Dashboard.dc.html`) | Mobile (`Mobile.dc.html`) |
|---|---|---|
| Pages | Dashboard, Receipts, Integrations (all "coming soon") | Home, Capture → Processing → Confirm → Saved, Receipts list, Receipt detail |
| Nav | Left sidebar, 3 items | Bottom tab bar, 3 items (Home / **Capture** / Receipts) |

That's **3 web pages and 7 mobile screens** — versus ~40 web routes and ~50 iOS screens in
PLAN.md. No auth screens, no budgets, no reports, no settings, no rules, no teams.

**My recommendation: build exactly what's designed, plus auth.** Ship that. Then pull from
PLAN.md's roadmap. Do not let the PLAN.md scope leak into v0 — that document is a 5-month
plan and this design is a 5-week one.

But note the design also introduces **two features PLAN.md never mentioned**, and both need
backend work you haven't budgeted for:
- **Financial health score** (0–100 ring gauge, on both platforms) — needs a defined formula
- **"Tips to optimize your budget"** (3–4 AI-generated cards) — needs an LLM call + caching

Both are specced in §2.6 and §2.7.

### 0.3 One design gap worth knowing now

The web dashboard uses `grid-template-columns: repeat(4,1fr)` and `2fr 1fr` with **no media
queries anywhere**. On a phone browser it will be unusable — four stat cards crushed into
375px. You asked to preview on your phone; the mobile app will look right, the web app will
not until we add breakpoints. That's a small task (~half a day) but it isn't in the mockup, so
someone has to decide the mobile layout. Flagging it rather than silently inventing one.

---

## 1. Tech stack

### The whole thing

| Layer | Choice | Why this one |
|---|---|---|
| **Monorepo** | pnpm workspaces + Turborepo | Web and mobile share types, validation, formatting, and design tokens. The two mockups already duplicate `fmtUsd`, `catColor`, `catAccent`, `initials`, and the category/hue map verbatim — that duplication should exist once. |
| **Mobile** | **Expo (SDK 54) + React Native + TypeScript + Expo Router** | Only practical iOS path from Windows. Expo Go = instant phone preview. EAS Build = cloud iOS builds + TestFlight, no Mac. |
| **Web** | **Next.js 15 (App Router) + TypeScript** | Server components make the dashboard aggregate queries clean; Vercel preview URLs give you per-branch phone previews for free. |
| **Styling (web)** | Tailwind v4 + shadcn/ui | Tailwind v4 supports `oklch()` natively — the design is *entirely* oklch, so this is a direct 1:1 port with no color conversion or drift. |
| **Styling (mobile)** | NativeWind v4 | Same Tailwind class names on both platforms, one shared token file. |
| **DB** | **Supabase Postgres** | Shared database for both apps, which is your requirement. Auth + Storage + row-level security in one product, plain Postgres underneath so nothing is locked in. |
| **Auth** | Supabase Auth — Sign in with Apple, Google, email OTP | One JWT works for web and mobile against the same RLS policies. Apple sign-in is mandatory for App Store if any social login exists. |
| **File storage** | Supabase Storage (private bucket, signed URLs) | Receipt images never public. Move to Cloudflare R2 only if image egress becomes a real cost. |
| **API** | Next.js Route Handlers (`apps/web/app/api/*`) + Hono | One deployable. Mobile hits the same endpoints as web. |
| **Jobs** | **Inngest** | Extraction and QuickBooks sync must be async, retryable, and observable. Runs as a Next.js route, so no extra infrastructure. |
| **Extraction** | **Claude (vision)** — `claude-sonnet-5` default, `claude-opus-4-8` on retry | Sonnet 5 handles clean receipts at low cost; escalate to Opus only when confidence is low. Roughly halves per-receipt cost vs Opus-always. |
| **Charts** | Hand-rolled SVG/divs (both platforms) | The design's charts are plain divs and one SVG arc. Pulling in Recharts would be *more* work than porting them, and would fight the mockup's exact styling. |
| **Payments** | RevenueCat (iOS) + Stripe (web) | Later — not in v0. |
| **Errors/analytics** | Sentry + PostHog | |
| **CI** | GitHub Actions + EAS Build + Vercel | |

### Repo layout

```
receiptraccoon/
├─ apps/
│  ├─ web/                  Next.js 15 — dashboard, receipts, integrations, + /api routes
│  └─ mobile/               Expo — home, capture, receipts
├─ packages/
│  ├─ shared/               ⭐ the contract layer — see below
│  │  ├─ types.ts           Receipt, LineItem, Category, ReceiptStatus…
│  │  ├─ schemas.ts         Zod schemas — validate at every boundary
│  │  ├─ api-client.ts      typed fetch wrapper, used by BOTH apps
│  │  ├─ format.ts          fmtUsd, fmtDate, initials  (lifted from the mockups)
│  │  ├─ categories.ts      the 10 categories + CAT_HUES + catColor/catAccent
│  │  └─ health.ts          financial health score — one implementation, both apps
│  ├─ ui-tokens/            oklch color/spacing/radius/type scale from the design
│  └─ db/                   Supabase migrations, RLS policies, seed data, generated types
└─ turbo.json
```

`packages/shared` is the single most important directory in this plan. It's what makes "both
apps share the same database" actually mean "both apps agree about what the data *means*" —
and it's what lets parallel agents work without drifting apart (§4).

---

## 2. Backend plan

### 2.1 Schema (v0 — matches the design exactly)

```sql
-- ─── identity ──────────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table workspaces (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  base_currency  char(3) not null default 'USD',
  created_at     timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid references workspaces on delete cascade,
  user_id      uuid references profiles on delete cascade,
  role         text not null default 'owner' check (role in ('owner','admin','member')),
  primary key (workspace_id, user_id)
);
-- v0 is single-user, but every row is workspace-scoped from day 1.
-- Retrofitting multi-tenancy later is the most expensive mistake available here.

-- ─── categories ────────────────────────────────────────────
create table categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,  -- null = system default
  name         text not null,
  hue          int  not null,      -- drives catColor()/catAccent() in the design
  sort_order   int  not null default 0,
  is_system    boolean not null default false
);
-- Seeded with the design's exact 10 + hues:
--   Meals 40 · Groceries 150 · Travel 230 · Office Supplies 285 · Software 262
--   Fuel 22 · Utilities 195 · Marketing 340 · Professional Services 305 · Other 250
-- A table, not an enum — users will add categories in v1 and enums are painful to alter.

-- ─── the core ──────────────────────────────────────────────
create type receipt_status as enum ('uploading','processing','needs_review','processed','failed');

create table receipts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces on delete cascade,
  created_by        uuid not null references profiles,
  status            receipt_status not null default 'uploading',

  image_path        text,              -- Supabase Storage key, never a public URL
  image_sha256      text,              -- duplicate detection
  source            text not null default 'mobile_camera',

  vendor            text,
  vendor_normalized text generated always as (lower(regexp_replace(coalesce(vendor,''),'[^a-z0-9]','','gi'))) stored,
  receipt_date      date,
  category_id       uuid references categories,

  currency          char(3) not null default 'USD',
  subtotal_cents    bigint,            -- integer minor units. NEVER floats for money.
  tax_cents         bigint,
  total_cents       bigint generated always as (coalesce(subtotal_cents,0) + coalesce(tax_cents,0)) stored,

  payment_brand     text,              -- 'Visa'  ─┬─ the design shows "Visa •4521" as one
  payment_last4     text,              -- '4521'  ─┘  string; store it split, format in shared/
  payment_type      text check (payment_type in ('credit','debit','cash','other')),

  notes             text,
  extraction_confidence numeric(3,2),  -- 0.00–1.00, drives needs_review routing
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on receipts (workspace_id, receipt_date desc);
create index on receipts (workspace_id, status);
create index on receipts (workspace_id, category_id);
create index on receipts (workspace_id, vendor_normalized);

create table receipt_line_items (
  id               uuid primary key default gen_random_uuid(),
  receipt_id       uuid not null references receipts on delete cascade,
  description      text not null,
  quantity         numeric(10,2) not null default 1,
  unit_price_cents bigint not null,
  amount_cents     bigint generated always as (round(quantity * unit_price_cents)) stored,
  sort_order       int not null default 0
);

-- ─── extraction audit trail ────────────────────────────────
create table extractions (
  id                uuid primary key default gen_random_uuid(),
  receipt_id        uuid not null references receipts on delete cascade,
  model             text not null,          -- 'claude-sonnet-5' | 'claude-opus-4-8'
  raw_response      jsonb not null,
  field_confidence  jsonb not null,         -- {"vendor":0.98,"total":0.99,"date":0.71,…}
  overall_confidence numeric(3,2) not null,
  input_tokens      int,
  output_tokens     int,
  cost_cents        numeric(8,4),
  duration_ms       int,
  created_at        timestamptz not null default now()
);
-- Append-only. Three payoffs: an audit trail for tax defensibility, a labeled eval set
-- (every human correction is a training signal), and per-receipt cost visibility from day 1.

create table receipt_edits (
  id          uuid primary key default gen_random_uuid(),
  receipt_id  uuid not null references receipts on delete cascade,
  edited_by   uuid not null references profiles,
  field       text not null,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);

-- ─── derived, cached ───────────────────────────────────────
create table health_scores (
  workspace_id uuid references workspaces on delete cascade,
  as_of_date   date not null,
  score        int not null check (score between 0 and 100),
  label        text not null,           -- 'On track' | 'Needs attention' | 'At risk'
  explanation  text not null,
  components   jsonb not null,          -- per-factor breakdown, for debugging + future UI
  primary key (workspace_id, as_of_date)
);

create table budget_tips (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid references workspaces on delete cascade,
  generated_for  date not null,
  tips           jsonb not null,        -- [{icon_letter, tone, text}]
  created_at     timestamptz not null default now(),
  unique (workspace_id, generated_for)
);

-- ─── integrations (schema now, wiring in v1) ───────────────
create table integrations (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces on delete cascade,
  provider              text not null check (provider in ('quickbooks','xero','freshbooks')),
  status                text not null default 'disconnected',
  external_realm_id     text,
  access_token_enc      text,           -- pgsodium / Supabase Vault. Never plaintext.
  refresh_token_enc     text,
  token_expires_at      timestamptz,
  unique (workspace_id, provider)
);

create table sync_records (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid not null references receipts on delete cascade,
  provider      text not null,
  external_id   text,
  state         text not null default 'pending',
  attempts      int not null default 0,
  last_error    text,
  synced_at     timestamptz,
  unique (receipt_id, provider)   -- ⭐ idempotency. Prevents double-posting to a ledger.
);
```

**RLS on every table**, no exceptions:

```sql
alter table receipts enable row level security;

create policy "members read own workspace receipts" on receipts for select
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));
-- …matching insert / update / delete policies, and the same shape on every other table.
```

RLS is what makes it safe for both apps to talk to one database. The mobile app ships its
Supabase anon key inside the binary where anyone can extract it — RLS is the only thing
standing between that key and everyone's receipts. Service-role keys stay server-side, always.

### 2.2 API surface (v0)

Both apps call these. All authenticated by Supabase JWT; all workspace-scoped by RLS.

| Method | Route | Purpose | Caller |
|---|---|---|---|
| `POST` | `/api/receipts/upload-url` | Returns signed Storage upload URL + a `receipts` row in `uploading` | mobile |
| `POST` | `/api/receipts/:id/process` | Marks uploaded, enqueues Inngest extraction | mobile |
| `GET` | `/api/receipts/:id` | One receipt + line items + signed image URL | both |
| `GET` | `/api/receipts` | List: `?month=&category=&q=&status=&cursor=` | both |
| `PATCH` | `/api/receipts/:id` | Edit any field; writes `receipt_edits`; flips `needs_review`→`processed` | both |
| `DELETE` | `/api/receipts/:id` | Soft delete | web |
| `GET` | `/api/dashboard` | ⭐ Every number on both home screens, one call — see §2.3 | both |
| `GET` | `/api/dashboard/breakdown?month=` | Category breakdown for the month picker | both |
| `GET` | `/api/receipts/export.csv` | The design's Export CSV button | web |
| `GET` | `/api/integrations` | Provider list + connection status | web |
| `POST` | `/api/inngest` | Job runner webhook | Inngest |

### 2.3 The `/api/dashboard` endpoint

Worth calling out because it's where mobile and web most easily drift apart. Both designs show
*the same numbers* — spend this month, tax paid, receipt count, health score, category
breakdown. If web computes them in a server component and mobile computes them client-side
from a receipt list, they **will** disagree, and a dashboard that contradicts itself across
your two apps destroys trust in the whole product.

So: one endpoint, backed by one Postgres function, consumed by both.

```jsonc
{
  "stats": {
    "monthTotalCents": 1_048_600,
    "monthDeltaPct": -12.4,          // vs previous month
    "allTimeCents": 5_842_300,
    "allTimeCount": 44,
    "taxCents": 55_900,
    "taxPctOfSpend": 5.3,
    "receiptCount": 14,
    "needsReviewCount": 3
  },
  "weeklySpend": [ { "weekStart": "2026-06-13", "totalCents": 41_200 }, … ],  // 6 buckets
  "categoryBreakdown": [ { "categoryId": "…", "name": "Travel", "hue": 230,
                           "amountCents": 628_500, "pct": 24.1 }, … ],
  "health": { "score": 82, "label": "On track", "explanation": "…" },
  "tips": [ { "iconLetter": "↑", "tone": "warn", "text": "…" }, … ],
  "recentReceipts": [ /* 5, pre-shaped for the design's row component */ ]
}
```

Implement the aggregates as a Postgres function (`get_dashboard(workspace_id, as_of date)`) so
it's one round trip and the grouping logic lives next to the data. Cache 60s.

### 2.4 Extraction pipeline

Triggered by `POST /api/receipts/:id/process`, run as an Inngest function:

```
1  fetch image from Storage, downscale to 1600px long edge, strip EXIF
2  sha256 → duplicate check (same workspace, ±3 days, same total) → flag if hit
3  Claude vision call, tool-use schema-constrained, model = claude-sonnet-5
       → vendor, date, currency, subtotal, tax, payment brand/last4/type,
         line items[], AND a self-reported confidence per field
4  validate:   subtotal + tax == total (±1¢)
               date is real and within [today-3y, today+2d]
               every line item amount > 0
               sum(line items) ≈ subtotal (±5%)
5  if overall_confidence < 0.85 OR any validation fails:
       retry once with claude-opus-4-8   ← escalate only when it's worth the money
6  categorize:  (a) this workspace's history for this vendor  →  else
                (b) global vendor→category map               →  else
                (c) Claude's own suggestion                  →  else 'Other'
7  write receipts + receipt_line_items + extractions (append-only)
8  status = confidence >= 0.85 && validations passed ? 'processed' : 'needs_review'
9  Supabase Realtime broadcast → mobile's Processing screen advances to Confirm
```

Step 9 is what makes the design's `Processing → Confirm` transition honest. The mockup fakes it
with `setTimeout(1400)`; the real thing subscribes to a Realtime channel on the receipt row and
navigates when status changes. Budget 3–8s for a real extraction — so the Processing screen
needs a slow path (a "still working…" message after ~10s) that the mockup doesn't have.

**Cost control:** Sonnet 5 first, Opus 4.8 only on low confidence. Cache by `image_sha256` so
a re-upload is free. Expect **~$0.004–0.012/receipt** blended. Every call's cost is written to
`extractions.cost_cents`, so you'll know your real per-user margin from week one rather than
guessing.

### 2.5 Storage & image handling

- Private bucket `receipts`, path `{workspace_id}/{receipt_id}/{uuid}.jpg`
- Mobile uploads directly to a signed URL — image bytes never pass through your API
- Compress client-side before upload (Expo `ImageManipulator`, ~1600px, q0.7 → ~200–400KB)
- Reads via short-lived (5 min) signed URLs
- Strip EXIF server-side — receipt photos carry GPS coordinates of where the user was

### 2.6 Financial health score — needs a definition

The design renders a ring at 82 (web) / 78 (mobile) with `label` and `explanation`, but the
mockup hardcodes them. Someone has to decide what the number *means*. Here's a defensible
starting formula — computed nightly per workspace, stored in `health_scores`:

| Factor | Weight | Definition |
|---|---:|---|
| Spend trend | 30 | This month vs 3-month trailing average. Flat or down = full marks. |
| Category concentration | 20 | Penalize when one non-essential category exceeds 40% of spend. |
| Receipt hygiene | 20 | % of receipts `processed` rather than sitting in `needs_review`. |
| Capture consistency | 15 | Receipts logged in ≥3 of the last 4 weeks. |
| Tax readiness | 15 | % of receipts with a category assigned and tax captured. |

`label`: ≥80 "On track" · 60–79 "Needs attention" · <60 "At risk" — matching the mockup's
thresholds exactly. `explanation` is templated from whichever factor moved most, not
LLM-generated (it must be stable and cheap; it renders on every dashboard load).

Two of these five factors measure *app engagement* rather than financial health, which is a
little self-serving. I'd rather say so than quietly ship it. If that bothers you, drop
"capture consistency" and reweight — but then a brand-new user with three receipts scores
oddly, so it needs a "not enough data yet" state either way. Worth 10 minutes of your input.

### 2.7 Budget tips

3–4 cards, LLM-generated. Generate **once per workspace per day** via a cron Inngest job, store
in `budget_tips`, serve from cache. Never generate on page load — that's an Opus-priced API
call on every dashboard refresh.

Input: category totals this month vs last, top vendors, detected duplicate subscriptions. The
mockup's own tips are a good few-shot prompt — especially the Adobe/Zoom/Slack/Workspace
overlap one, which is genuinely the most useful of the four and the pattern to aim for.

### 2.8 Auth flow

Not designed anywhere in the mockups — you'll need to decide the screens. Minimum viable:

- **Mobile:** Sign in with Apple (required), Google, email OTP. Session in `expo-secure-store`.
- **Web:** same providers, cookie session.
- On first sign-in: create `profile` → create personal `workspace` → add `workspace_member` as
  owner → seed the 10 system categories. One Postgres trigger on `auth.users` insert.

---

## 3. Previewing on your phone

### 3.1 Mobile app — Expo Go (this is the fast path)

```bash
cd apps/mobile && pnpm expo start
```

QR code appears in the terminal. Scan it with your iPhone camera, Expo Go opens the app. Save a
file, it hot-reloads on the phone in about a second. Both your laptop and phone need to be on
the same Wi-Fi — if your network blocks device-to-device traffic, `pnpm expo start --tunnel`
routes around it.

**The one constraint:** Expo Go only includes Expo's prebuilt native modules. `expo-camera`
works there; `react-native-vision-camera` does not. So **v0 uses `expo-camera`** and you keep
QR-code previewing throughout the whole build. If we later need Vision Camera's frame
processors for live edge detection, that's a one-time `eas build --profile development` to
produce a custom dev client — same QR workflow after that, just a different app on your phone.

### 3.2 Mobile app — real builds, no Mac

```bash
eas build --platform ios --profile preview      # installable build, shareable link
eas build --platform ios --profile production   # → TestFlight
eas update --branch preview                     # OTA JS update, no rebuild, ~30 seconds
```

All compiled on Expo's macOS runners. You need an Apple Developer account ($99/yr) before the
first build — worth doing early, since account setup and certificates are the usual first-time
snag. `eas update` is the one to remember: after the first native build, most changes ship to
your phone in under a minute without going near a build queue.

### 3.3 The camera tradeoff, honestly

Native iOS has `VNDocumentCameraViewController` — Apple's document scanner with automatic edge
detection, perspective correction, and multi-page capture, free and excellent. React Native has
nothing that good out of the box.

Mitigations, in order of what I'd actually do:
1. **v0: plain `expo-camera` + a framing guide overlay.** This is exactly what the mockup
   already shows — a dashed rectangle and "Align receipt in frame." The design isn't asking for
   auto-crop, so ship what's designed.
2. **Server-side deskew** during extraction — Claude vision handles uncropped, angled receipts
   far better than traditional OCR did, so the crop matters much less than it used to.
3. **v1 if capture quality complaints appear:** `react-native-document-scanner-plugin`, which
   wraps VisionKit on iOS. Needs a dev client, ~1 day of work.

### 3.4 Web app on your phone

- **Local:** `pnpm dev` then `npx localtunnel --port 3000` for a public URL.
- **Better:** connect the repo to Vercel. Every branch gets a preview URL you can open on your
  phone. Zero config, and you can send links to other people.
- Remember §0.3 — the web design has no mobile breakpoints, so it'll look broken on a phone
  until those are added.

---

## 4. Multi-agent workflow

### 4.1 The principle that makes this work or fail

**Every subagent starts cold.** It has no memory of this conversation, the design files, or
decisions we've made. So the quality of parallel agent work is determined almost entirely by
whether a written contract exists *before* they start.

Which means the sequence is non-negotiable:

> **I build the foundation myself (schema, shared types, Zod contracts, design tokens).
> Only then do agents run in parallel against it.**

Skip that and you get four agents inventing four incompatible `Receipt` types, three different
money representations, and two `formatCurrency` helpers that round differently. The merge costs
more than the parallelism saved. I've scoped the plan around this.

The corollary: **fewer, larger agents beat many small ones.** Each spawn re-derives context from
scratch, which is the expensive part. Six well-scoped agents will outperform twenty narrow ones.

### 4.2 Model assignment, and the reasoning

| Model | Gets this work | Why |
|---|---|---|
| **Opus 4.8** (me, directly) | Schema design, shared type contracts, extraction prompt engineering, QuickBooks sync, all code review, cross-track consistency sweeps | Work where a wrong decision propagates everywhere or is expensive to reverse. Schema mistakes get baked into both apps; sync bugs corrupt a real accounting ledger; review is where judgment beats throughput. |
| **Sonnet 5** | Porting mockups → components, CRUD endpoints, list/filter/search, CSV export, RLS policy authoring, tests | High-volume, well-specified implementation. The designs are *pixel-complete* with exact oklch values and layout — translation, not invention. Sonnet is strong at this and roughly 5× cheaper, which is the whole point of your ask. |
| **Haiku 4.5** | Seed data, fixtures, icon extraction, boilerplate config, doc formatting | Mechanical transformation with an obvious right answer. |

The honest summary: **Opus decides, Sonnet builds, Opus reviews.**

### 4.3 The phases

#### Phase 0 — Foundation ▸ me, Opus 4.8, no delegation ▸ ~1 day

Monorepo scaffold · full schema + migrations + RLS · `packages/shared` types and Zod schemas ·
design tokens extracted from the two `.dc.html` files · `packages/db` seed data · the OpenAPI-ish
spec for §2.2.

Not delegated because everything downstream is defined by it, and because I have the design
files loaded in context right now — a subagent would have to re-read and re-derive all of it.

#### Phase 1 — Parallel build ▸ 5 agents, isolated git worktrees ▸ ~1 week

| # | Agent | Model | Scope | Why this model |
|---|---|---|---|---|
| **A** | Web UI | Sonnet 5 | Dashboard, Receipts table + filters, Integrations, receipt detail drawer, CSV export. Port `Dashboard.dc.html` 1:1. | Fully specified down to hex-equivalent oklch values. Zero design judgment required. |
| **B** | Mobile UI | Sonnet 5 | Home, Receipts list, Receipt detail, Capture → Processing → Confirm → Saved, tab bar. Port `Mobile.dc.html` 1:1. | Same. |
| **C** | Backend CRUD | Sonnet 5 | All §2.2 routes except extraction, the `get_dashboard` Postgres function, CSV export, RLS policies + tests. | Contracts already written in Phase 0, so this is filling in known shapes. |
| **D** | Extraction pipeline | **Opus 4.8** | Claude vision call, output schema, confidence scoring, validation, retry/escalation, categorization, Realtime broadcast. | The product's core quality signal. Prompt design and confidence calibration are exactly the judgment-heavy work Sonnet is weaker at, and getting it wrong invalidates the product thesis. |
| **E** | Auth + infra | Sonnet 5 | Supabase Auth wiring both apps, signup trigger, session handling, Sentry, CI, EAS config. | Well-trodden paths with good documentation. |

Worktree isolation (`isolation: "worktree"`) so five agents don't collide on one working tree.
A and B can't conflict — different apps. C and E both touch `apps/web`, so they run
sequentially or with a clear file split.

#### Phase 2 — Review gates ▸ Opus 4.8 ▸ ~2 days

This is where you specifically wanted the heavier model, and I agree — it's the highest-leverage
Opus spend in the whole plan.

| Gate | Tool | Looking for |
|---|---|---|
| **Per-track review** | `/code-review high` on each track's diff | Correctness bugs before they compound |
| **Consistency sweep** ⭐ | dedicated Opus agent across all tracks | The signature multi-agent failure: duplicated helpers, divergent date handling, money as float in one place and cents in another, inconsistent error shapes. Nothing else catches this — each agent's own work looks fine in isolation. |
| **Security review** | `/security-review` | RLS gaps, service-role key leakage into the mobile bundle, signed-URL scope, token encryption |
| **Design fidelity** | Opus + Browser tools vs the mockup | Actual rendered output compared against `.dc.html`, side by side |

The consistency sweep is the one I'd insist on. Everything else is standard practice; that one
exists specifically because we chose to parallelize.

#### Phase 3 — Integration & preview ▸ me + Sonnet ▸ ~2 days

Wire tracks together · end-to-end run: photo on your phone → extraction → both dashboards ·
`/verify` on the real flow · Vercel deploy + EAS preview build · **you preview on your phone.**

#### Phase 4 — QuickBooks ▸ Opus 4.8 ▸ ~1 week, after v0 is stable

OAuth, account mapping, Purchase + Attachable creation, idempotency, token refresh, sync log.
Opus for the same reason as the extraction pipeline: this one writes to a real general ledger,
and a double-post is the worst bug this product can produce.

### 4.4 Timeline

| Phase | Duration | Model mix |
|---|---|---|
| 0 · Foundation | 1 day | Opus |
| 1 · Parallel build | ~1 week | 4× Sonnet, 1× Opus |
| 2 · Review gates | 2 days | Opus |
| 3 · Integration | 2 days | Opus + Sonnet |
| **v0 on your phone** | **~2 weeks** | |
| 4 · QuickBooks | 1 week | Opus |

Serial single-agent would be roughly 3–4 weeks for the same scope. The parallelism is worth
maybe 40% — real, but less than it looks, because Phase 0 and Phase 2 can't be parallelized
and they're where the hard thinking lives.

### 4.5 Where I'd *not* use agents

Being straight with you, since "use a multi-agent workflow" can turn into theater:

- **Phase 0** — context is already in my head; delegating means paying to rebuild it.
- **Anything cross-cutting** — a change touching shared types and both apps at once is worse
  in three agents than in one.
- **Debugging** — needs the full conversation history. Cold agents are bad at it.
- **Decisions you should make** — the health score formula, the web mobile-breakpoint layout,
  category taxonomy. Those come back to you, not to an agent.

---

## 5. What I need from you before Phase 0

1. **Health score formula** — accept §2.6 as-is, or adjust the weights? (Ready to proceed with
   my version if you'd rather not spend time on it.)
2. **Web mobile layout** — how should the 4-across stat grid behave on a phone? My default:
   2×2 grid, charts stack full-width, receipts table becomes cards.
3. **Auth providers** — Apple + Google + email, or narrow it for v0?
4. **Supabase project** — do you have one, or should I plan for local Postgres first?
5. **Apple Developer account** — enrolled? Needed before the first EAS build, and enrollment
   can take a couple of days.
6. **Scope confirmation** — build exactly the mockups + auth for v0, holding everything else in
   PLAN.md for later? That's my strong recommendation.
