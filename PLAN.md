# ReceiptRaccoon — Product & Technical Plan

> Status: planning only. No code written yet.
> Last updated: 2026-07-18

---

## 0. Naming note (decide before anything else)

You wrote **ReceiptRacoon**, the folder is **ReceiptRaccoon**. "Raccoon" is the correct
spelling and the one people will type. Recommendation: use **ReceiptRaccoon**, and buy
both `receiptraccoon.com` and `receiptracoon.com` (redirect the misspelling). App Store
name: `ReceiptRaccoon: Receipt Scanner` — the keyword suffix matters for ASO.

---

## 1. Product thesis

**Who it's for (v1):** self-employed people, freelancers, contractors, and 1–10 person
businesses in the US/CA who already use QuickBooks Online and currently shoebox their
receipts.

**The job:** "I spent money. Make it show up correctly in my books and in my tax
deductions without me typing anything."

**Why we win vs Easy Expense:** they are strong at capture + mileage + tax deductions, but
their web experience is thin — it's a mobile app with an export button. Our wedge is
**capture on iOS, understand on the web**: a genuine financial dashboard (position, budgets,
category trends, forecasting) that makes the app useful *between* tax seasons, plus
first-class two-way QuickBooks sync rather than CSV export.

**One-line positioning:** *Snap a receipt, and it's already booked, categorized, and
budgeted against.*

### Competitor benchmark (Easy Expense, observed 2026-07)

| Capability | Easy Expense | ReceiptRaccoon v1 | ReceiptRaccoon later |
|---|---|---|---|
| OCR receipt capture + auto-crop | ✅ | ✅ | |
| AI field extraction (vendor/total/tax/date/payment) | ✅ | ✅ | |
| Email receipt ingest (Gmail + forwarding address) | ✅ | ✅ forwarding addr | ✅ Gmail/Outlook OAuth |
| GPS mileage tracking | ✅ | ❌ | ✅ Phase 3 |
| Bank/card transaction linking | ✅ (paid) | ❌ | ✅ Phase 3 (Plaid) |
| PDF/CSV/Excel export | ✅ | ✅ | |
| Teams / multi-user | ✅ (paid) | ❌ (data model ready) | ✅ Phase 4 |
| **QuickBooks two-way sync** | weak/export | ✅ **core** | Xero, FreshBooks |
| **Real web dashboard + budgets** | ❌ | ✅ **core** | forecasting |

Their pricing anchors us: consumer tiers ~$2.99–$5.99, Professional/Teams ~$23.99/mo or
~$144.99/yr. That's the price band to sit in.

---

## 2. Scope: what v1 is and is not

**In scope for v1 (the thing we ship to the App Store):**
capture → extract → categorize → review → sync to QuickBooks → view on web dashboard →
budgets → export.

**Explicitly out of v1:** Android, mileage/GPS, bank feeds, OCR of invoices/bills (as
distinct from receipts), multi-currency FX conversion beyond storing the original currency,
teams/approvals, accountant portal, Xero.

Cutting mileage and bank feeds is deliberate — each is a multi-week subsystem with its own
permissions, compliance, and support burden, and neither is required to prove the core loop.

---

## 3. Architecture

```
┌────────────────────┐        ┌──────────────────────┐
│  iOS app (SwiftUI) │        │  Web app (Next.js)   │
│  VisionKit scanner │        │  dashboard/budgets   │
└─────────┬──────────┘        └──────────┬───────────┘
          │  HTTPS / JWT                 │
          └──────────────┬───────────────┘
                         ▼
              ┌──────────────────────┐
              │   API (TypeScript)   │  Fastify or Next route handlers
              │   auth, CRUD, RLS    │
              └───────┬──────────────┘
                      │ enqueue
          ┌───────────▼────────────┐
          │  Job runner (Inngest)  │
          │  • OCR/extract         │
          │  • duplicate detect    │
          │  • categorize          │
          │  • QuickBooks push     │  ← retries, backoff, dead-letter
          └───────────┬────────────┘
                      ▼
   ┌────────────┬──────────────┬────────────────┬──────────────┐
   │ Postgres   │ Object store │ Claude (vision)│ Intuit QBO   │
   │ (Supabase) │ (S3/R2)      │ extraction     │ Accounting   │
   └────────────┴──────────────┴────────────────┴──────────────┘
```

### Stack recommendation

| Layer | Choice | Why |
|---|---|---|
| iOS | **Native Swift + SwiftUI** | VisionKit `VNDocumentCameraViewController` gives best-in-class edge detection and multi-page capture for free; on-device `VNRecognizeTextRequest` gives instant preview text; background upload via `URLSession` background tasks survives app kill. This is the one place native pays for itself. |
| Web | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** | Fast to build, good tables/forms, server components for the dashboard queries. |
| Charts | **Recharts** | Sufficient for category/trend/budget visuals. |
| Backend | **TypeScript API** (Fastify standalone, or Next route handlers to start) | One language across web + backend. Start inside Next; extract when jobs get heavy. |
| DB | **Postgres via Supabase** | Auth + storage + row-level security in one, cheap at this stage, plain Postgres so no lock-in on the data itself. |
| Files | **Supabase Storage or Cloudflare R2** | R2 if image egress grows (no egress fees). |
| Jobs/queue | **Inngest** (or Trigger.dev) | OCR and QuickBooks sync must be retryable, idempotent, and observable. Do not run these inline in a request. |
| Extraction | **Claude (vision) as primary** + Apple Vision on-device for instant preview | See §5. |
| Auth | Supabase Auth: Sign in with Apple (required by App Store if any social login), Google, email magic link | |
| Payments | **RevenueCat** on iOS, **Stripe** on web | RevenueCat normalizes StoreKit receipts and gives one entitlement check both platforms can read. |
| Error/analytics | Sentry + PostHog | |

**Alternative considered:** React Native/Expo for iOS to share code with web. Rejected for
v1 — the camera and background-upload path is the product's core quality signal, and RN adds
friction exactly there. Revisit if/when Android becomes a priority (Phase 4), at which point
the backend and design system are already shared anyway.

---

## 4. Data model (core tables)

```
users              id, email, name, auth_provider, created_at
workspaces         id, name, country, base_currency, fiscal_year_start, tax_scheme(none|vat|gst|sales_tax)
workspace_members  workspace_id, user_id, role(owner|admin|member|accountant)   ← teams-ready from day 1
subscriptions      workspace_id, plan, status, source(revenuecat|stripe), current_period_end

receipts           id, workspace_id, uploaded_by, source(camera|photo_library|email|web_upload|pdf)
                   status(uploaded|processing|needs_review|ready|synced|failed|archived)
                   captured_at, created_at
receipt_files      receipt_id, storage_key, page_number, mime, width, height, sha256   ← multi-page
extractions        receipt_id, model_version, raw_json, confidence_overall, per_field_confidence, created_at
                                                          ↑ never overwrite; keep every attempt for audit + eval

expenses           id, receipt_id(nullable), workspace_id, vendor_id, category_id
                   date, currency, subtotal, tax_total, tip, total
                   payment_method(card|cash|bank|other), last4, notes
                   is_billable, is_reimbursable, is_personal, client_id, project_id
                   created_by, edited_by_human(bool), created_at, updated_at
expense_tax_lines  expense_id, rate_name, rate_pct, amount           ← VAT/GST/multi-rate receipts
expense_line_items expense_id, description, qty, unit_price, amount  ← itemized receipts (Phase 2)
expense_splits     expense_id, category_id, amount, note             ← one receipt, several categories

vendors            id, workspace_id, display_name, normalized_name, default_category_id, logo_url
categories         id, workspace_id, name, parent_id, icon, color, tax_deductible(bool),
                   qbo_account_id, is_system
rules              id, workspace_id, priority, match_json, action_json, enabled  ← auto-categorization
budgets            id, workspace_id, category_id(nullable=overall), period(month|quarter|year),
                   amount, starts_on, rollover(bool), alert_thresholds_pct[]

integrations       id, workspace_id, provider(quickbooks|xero|gmail),
                   external_realm_id, access_token(enc), refresh_token(enc), expires_at, status
sync_records       id, expense_id, provider, external_id, external_type(Purchase|Attachable),
                   direction, state(pending|synced|error|conflict), last_attempt_at, attempts, error
                   UNIQUE(expense_id, provider)                       ← idempotency key
audit_log          workspace_id, actor, entity, entity_id, action, before_json, after_json, at
```

**Deliberate choices worth calling out:**
- `receipts` and `expenses` are separate. One receipt can produce one expense (usual), or a
  split, or none (a duplicate). One expense can exist with no receipt (manual entry).
- Extractions are append-only. This gives an audit trail for tax defensibility *and* a
  labeled eval set for improving the model — every human edit is a training signal.
- All money stored as integer minor units + ISO currency code. Never floats.
- `workspace_id` on everything from day 1, with RLS policies. Retrofitting multi-tenancy
  later is the single most expensive mistake available here.

---

## 5. The extraction pipeline (the hard part)

This is where the product lives or dies. Users forgive a plain dashboard; they do not
forgive re-typing a total.

**Flow:**
1. **On-device (instant, <1s):** VisionKit auto-crops and de-skews; `VNRecognizeTextRequest`
   pulls raw text. Show a provisional total/vendor immediately so the app feels instant. Also
   means capture works fully offline.
2. **Upload:** compressed JPEG (~1600px long edge, quality 0.7) + the raw OCR text + a
   client-side `sha256` for dedupe. Background-uploadable; queued if offline.
3. **Server extract:** Claude vision call with a strict JSON schema — vendor, date, currency,
   subtotal, tax lines, tip, total, payment method, last4, line items, plus **per-field
   confidence**. The on-device OCR text is passed alongside the image as a hint.
4. **Validate:** arithmetic check (`subtotal + tax + tip == total`), date sanity, currency
   plausibility. Any failure → drop confidence, route to review.
5. **Duplicate detection:** image hash + (vendor, date, total) fuzzy match within ±3 days.
6. **Categorize:** in priority order — (a) user rules, (b) this workspace's history for that
   vendor, (c) global vendor→category prior, (d) LLM suggestion. Always record *which* fired.
7. **Route:** overall confidence ≥ threshold and arithmetic checks pass → `ready` (auto-sync
   if enabled). Otherwise → `needs_review` inbox, with low-confidence fields highlighted.
8. **Sync:** enqueue QuickBooks push (§6).

**Build vs buy for extraction:** Claude-first is the recommendation — one vendor, schema you
control, handles messy/crumpled/foreign receipts well, and improves without work on our part.
Budget roughly **$0.005–0.02 per receipt**; at 200 receipts/user/month that's ~$1–4/user/month
against a $10–25 price point, which works. Purpose-built alternatives (Veryfi, Mindee, Taggun,
Google Document AI) are worth benchmarking in Week 1 on a real 200-receipt corpus — if one is
materially better on tax lines, use it for extraction and Claude for the judgment calls.

**Do this in Week 1, before writing app code:** collect 200 real receipts (crumpled, faded,
thermal, restaurant, gas, foreign, multi-page), build a tiny eval harness, and measure
field-level accuracy. Every later decision depends on those numbers. Target for launch:
**≥95% on total, ≥93% on date, ≥90% on vendor, ≥85% on tax**, with a calibrated confidence
score that catches most of the misses.

---

## 6. QuickBooks integration

**API:** Intuit QuickBooks Online Accounting API v3, OAuth 2.0 + OpenID.

**Mapping:**
- Cash/card receipt → **Purchase** entity (`PaymentType`: Cash / CreditCard / Check),
  `AccountRef` = the expense account mapped from our category, `EntityRef` = vendor.
- Receipt image → **Attachable**, linked to the Purchase. This is the part accountants
  actually care about at audit time.
- Tax → `TxnTaxDetail` where the region supports it (Canada GST/HST, UK VAT).
- Vendors: match on normalized name, create if absent, cache the QBO id on our `vendors` row.
- Categories: user maps each ReceiptRaccoon category → a QBO expense account once, in a
  dedicated mapping UI. Unmapped category = blocked sync with a clear "map this" prompt,
  never a silent wrong-account post.

**Non-negotiables:**
- **Idempotency.** `sync_records UNIQUE(expense_id, provider)` plus Intuit's request-id header.
  Double-posting into someone's general ledger is the worst possible bug in this product.
- **Token refresh.** Refresh tokens rotate and expire (~100 days); a background job refreshes
  proactively and emails the user before a hard disconnect.
- **Backoff + dead-letter.** Rate limits are real (~500 req/min/realm). Failures surface on a
  visible Sync Log page, never silently.
- **Two-way (Phase 2):** pull QBO chart of accounts and vendor list so mapping is a picker,
  not free text. Full transaction pull-back only if bank feeds land.
- **Sandbox first.** Build entirely against Intuit's sandbox company.

⚠️ **Start the Intuit production-app review in Week 2, not Week 12.** Getting an app approved
for production QuickBooks access involves a security questionnaire and review that can take
weeks. It is the most likely thing to delay launch, and it's pure calendar time you can run in
parallel with development. Same for the App Store: reserve the bundle ID and set up App Store
Connect early.

---

## 7. iOS app — every screen

### 7.1 Onboarding & auth
1. **Splash / launch**
2. **Welcome carousel** — 3 cards: snap it, we book it, see it. Skippable.
3. **Sign in** — Sign in with Apple, Google, email magic link
4. **Workspace setup** — business name, business type, country, currency, fiscal year start
5. **Category preset picker** — Freelancer / Contractor / Retail / Consultant / Custom
6. **Connect QuickBooks** (skippable, re-promptable later)
7. **Paywall** — annual default, 7-day trial, monthly alternative
8. **Permission primers** — camera, notifications (each a plain-English screen *before* the
   system dialog; never ask for a permission we aren't about to use — that's exactly the
   complaint in Easy Expense's negative reviews)
9. **First-capture coach** — one guided scan

### 7.2 Tab bar
`Receipts` · `Insights` · **`Scan`** (center, prominent) · `Reports` · `Settings`

### 7.3 Capture flow
10. **Camera** — auto edge detect, auto-shutter, flash, torch, batch mode counter, gallery
    shortcut, multi-page toggle
11. **Crop & rotate review** — per page, add page, delete page, retake
12. **Processing** — provisional fields visible immediately, spinner on the rest
13. **Extraction review** — the most important screen in the app. Editable: vendor, date,
    total, subtotal, tax lines, tip, currency, category, payment method + last4, notes, tags,
    billable / reimbursable / personal toggles, client/project. Low-confidence fields visibly
    flagged. Tap a field → the corresponding region of the receipt image highlights.
14. **Split expense** — divide one receipt across categories/clients
15. **Saved confirmation** — with sync status and an undo affordance

### 7.4 Receipts
16. **Receipt list** — grouped by month; thumbnail, vendor, amount, category chip, sync badge;
    infinite scroll
17. **Search & filter sheet** — text, date range, category, vendor, amount range, payment
    method, sync status, has-image, billable
18. **Bulk select mode** — categorize, tag, delete, add to report, retry sync
19. **Receipt detail** — full-screen image viewer (pinch zoom, page swipe), all fields, edit,
    change history, "Open in QuickBooks" deep link, delete/archive
20. **Needs Review inbox** — low-confidence extractions queued for a quick swipe-through
21. **Duplicates inbox** — side-by-side compare, keep/merge/discard
22. **Failed sync inbox** — with the actual error and a fix action

### 7.5 Import (non-camera)
23. **Photo library import** — multi-select, batch process
24. **Files / PDF import**
25. **Share extension** — share a PDF or image from Mail/Safari straight into the app
26. **Email forwarding setup** — your personal `you@in.receiptraccoon.com` address, copy button
27. **Gmail/Outlook connect** (Phase 2)

### 7.6 Insights (mobile-light; the web is where depth lives)
28. **Insights home** — this month's spend, vs last month, category donut, top 5 vendors,
    budget progress bars, estimated deductions, uncategorized count
29. **Category detail** — trend line + the expense list behind it

### 7.7 Reports & export
30. **Reports list**
31. **Report builder** — date range, filters, which columns, include images
32. **Report preview** — paginated PDF preview
33. **Export & share** — PDF / CSV / Excel, share sheet, email to accountant

### 7.8 Settings
34. **Account & profile**
35. **Workspaces** — switch, create, (invite members — Phase 4)
36. **Categories** — CRUD, reorder, set deductible flag, map to QBO account
37. **Rules** — "if vendor contains X → category Y, tag Z"
38. **Integrations** — QuickBooks connect/disconnect/status, **Sync Log**, account mapping
39. **Tax settings** — country, tax scheme, default rates, fiscal year
40. **Notifications** — review reminders, weekly digest, budget alerts, sync failures
41. **Security** — Face ID / passcode app lock, active sessions
42. **Subscription** — current plan, manage, restore purchases
43. **Data** — export everything, delete account (App Store now requires in-app deletion)
44. **Help & support** — FAQ, contact, send diagnostics
45. **Legal** — privacy, terms
46. **About / What's new**

### 7.9 Cross-cutting
47. **Offline queue indicator** — pending uploads, retry
48. **Paywall variants** — hard gate, soft upsell, limit-reached
49. **Empty / error / no-network states** for every list
50. **Widgets & Shortcuts** — home-screen "Scan receipt" widget, Siri Shortcut, Control Center
    quick action (Phase 2 — but cheap and a genuine retention lever)

---

## 8. Web app — every page

### 8.1 Marketing (public)
- `/` home · `/features` · `/pricing` · `/integrations` and `/integrations/quickbooks`
- `/for-accountants` · `/blog` + posts · `/help` docs
- `/privacy` · `/terms` · `/dpa` · `/security` · `/status`

### 8.2 Auth
- `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/verify-email`
- `/invite/[token]` (accept team invite) · `/onboarding` (mirrors iOS setup)

### 8.3 App
| Route | Contents |
|---|---|
| `/dashboard` | **Financial position header** (spend MTD, vs budget, vs last month, est. deductions, uncategorized count). Spend-over-time chart, category breakdown (donut + ranked bars), top vendors, budget progress rail, recent receipts, action cards ("12 need review", "3 failed to sync"). Date-range and workspace switchers apply globally. |
| `/expenses` | Dense sortable/filterable table: date, vendor, category, total, tax, payment, status, sync badge. Inline edit, bulk edit, saved views, column picker, CSV export of current view. |
| `/expenses/[id]` | Detail drawer/page: receipt image side-by-side with fields, edit, splits, line items, change history, sync status. |
| `/inbox` | Needs-review queue — keyboard-driven (`j/k` move, `1–9` categorize, `Enter` approve). This is how a power user clears 80 receipts in ten minutes. |
| `/upload` | Drag-and-drop multi-file / PDF upload with per-file progress. |
| `/duplicates` | Side-by-side merge/discard. |
| `/categories` | Manage tree, colors, deductible flags, QBO account mapping, merge categories. |
| `/vendors` | Vendor list w/ spend totals, merge duplicates, set default category. |
| `/rules` | Auto-categorization rule builder, priority ordering, "test against last 100 receipts" preview. |
| `/budgets` | Create/edit per-category and overall budgets; monthly/quarterly/annual; rollover; alert thresholds. |
| `/budgets/[id]` | Burn-down chart, contributing expenses, pace-vs-period projection. |
| `/reports` | Saved reports list + scheduled email reports. |
| `/reports/new` | Report builder: range, grouping, filters, columns, include images. |
| `/reports/spend-by-category` | Category × month matrix + stacked area. |
| `/reports/tax-summary` | Deductible totals by category, ready for a tax preparer. |
| `/reports/vendors` | Vendor spend ranking + trend. |
| `/integrations` | Connected services + health. |
| `/integrations/quickbooks` | Connect/disconnect, realm info, **account mapping table**, sync direction settings, auto-sync toggle. |
| `/integrations/quickbooks/log` | Every sync attempt: expense, timestamp, result, error, retry button. |
| `/settings/workspace` | Name, country, currency, fiscal year, tax scheme. |
| `/settings/members` | Invite, roles, remove (Phase 4). |
| `/settings/profile` | Name, email, password, 2FA. |
| `/settings/notifications` | Digest and alert preferences. |
| `/settings/billing` | Plan, invoices, payment method, cancel (Stripe portal). |
| `/settings/data` | Full export (ZIP of images + CSV/JSON), delete workspace. |
| `/audit-log` | Who changed what, when. |
| `/admin` | Internal-only: user lookup, re-run extraction, impersonate w/ consent, extraction accuracy metrics. |

---

## 9. Roadmap

Estimates assume **one experienced full-stack developer working with AI assistance**. Double
them for part-time work.

### Phase 0 — Validation (Week 1) ⭐ do not skip
Collect the 200-receipt corpus. Build the eval harness. Benchmark Claude vs 1–2 receipt-OCR
vendors. Prototype the Intuit sandbox: OAuth → create a Purchase with an Attachable.
**Gate: extraction hits the accuracy targets in §5 and a receipt lands in QuickBooks sandbox.**
If extraction isn't good enough, the entire product thesis changes — better to learn it in
week 1 than month 3.

Also in Week 1–2, in parallel: register the Intuit app and start production review; reserve
the App Store bundle ID; buy the domains.

### Phase 1 — Core loop (Weeks 2–7)
Backend: schema, auth, RLS, storage, extraction pipeline, jobs.
iOS: onboarding, capture, review, receipt list/detail, settings core.
Web: login, dashboard v1, expenses table, categories.
**Milestone: photo in → correct expense out, visible on both platforms.**

### Phase 2 — QuickBooks + review workflows (Weeks 8–11)
QBO OAuth, account mapping UI, sync engine w/ idempotency + retries + sync log, needs-review
inbox, duplicate detection, rules engine, email forwarding ingest.
**Milestone: end-to-end sync, and a user can clear 50 receipts in under 10 minutes.**

### Phase 3 — Dashboard depth + monetization (Weeks 12–15)
Budgets, trend/category/vendor reports, tax summary, PDF/CSV/Excel export, scheduled email
reports, RevenueCat + Stripe, paywall, widgets/Shortcuts.
**Milestone: beta with 20–30 real users, paid.**

### Phase 4 — Launch & expand (Weeks 16–20)
Polish, App Store submission, marketing site, help docs, support tooling.
Then, priority-ordered by demand: **mileage tracking** → **Gmail/Outlook ingest** →
**bank feeds (Plaid)** → **teams & approvals** → **Xero** → **Android**.

**Realistic total to a paid public launch: ~4–5 months full-time.**

---

## 10. Pricing (proposed)

| | Free | Pro | Business |
|---|---|---|---|
| Price | $0 | **$9.99/mo · $79/yr** | **$24.99/mo · $199/yr** |
| Receipts/month | 15 | Unlimited | Unlimited |
| Web dashboard | read-only | full | full |
| Budgets | 1 | Unlimited | Unlimited |
| QuickBooks sync | — | ✅ | ✅ |
| Email forwarding | — | ✅ | ✅ |
| Reports/export | CSV only | PDF+CSV+Excel, scheduled | + custom builder |
| Team members | 1 | 1 | 5 (then $6/seat) |
| Support | email | priority | priority + onboarding call |

Free tier exists to get receipts into the system — the switching cost of accumulated history is
the moat. Annual is the default CTA; annual conversion is what makes the ~$1–4/user/month
extraction cost comfortable. Prices sit just under Easy Expense's Professional tier, with a
better web product as the justification.

---

## 11. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Extraction accuracy below expectation | **Critical** | Phase 0 gate before building anything; confidence-routed review inbox so misses degrade to "quick tap" not "wrong data" |
| Intuit production approval delays launch | **High** | Start Week 2; ship with CSV/IIF export as fallback |
| Double-posting to a user's ledger | **High** | Idempotency key + unique constraint + sync log + integration tests against sandbox |
| LLM cost scales past pricing | Medium | Cache by image hash; downscale images; on-device pre-filter for blurry/blank; monitor cost/user weekly |
| App Store rejection (permissions, deletion, subscriptions) | Medium | In-app account deletion, Sign in with Apple, permission primers, honest privacy nutrition label |
| Financial-data compliance burden | Medium | Encrypt tokens at rest, RLS everywhere, 7-year retention policy, audit log; SOC 2 only when a customer requires it |
| Building mileage/bank feeds too early | Medium | Explicitly deferred to Phase 4, demand-ordered |

---

## 12. Success metrics

- **Capture→correct rate:** % of receipts needing zero field edits. *Target ≥70% at launch, 85% by month 3.* This is the single number that predicts retention.
- **Time to first receipt** from install. *Target < 90 seconds.*
- **Sync success rate.** *Target ≥99%.*
- **Week-4 retention.** *Target ≥40% of activated users.*
- **Trial→paid conversion.** *Target ≥25%.*
- **Extraction cost per active user per month.** *Ceiling: 20% of ARPU.*

---

## 13. Open questions for you

1. **Geography** — US-only at launch, or US+Canada+UK? This decides tax handling (sales tax vs
   GST/HST vs VAT) and it's much cheaper to design for now than to retrofit.
2. **Sole proprietor vs small business** — who's the primary v1 user? Affects whether we lead
   with "tax deductions" or "know your numbers."
3. **QuickBooks Online only, or Desktop too?** Recommendation: Online only (Desktop needs a
   different, much worse integration path).
4. **Free tier — yes or no?** I've assumed yes; it's a real support-cost decision.
5. **"Financial position" scope** — full position needs *income* data, which means bank feeds
   or manual entry. For v1 I've scoped the dashboard to expense-side position. Is that enough,
   or is income in scope for v1?
6. **Do you want mileage in v1 after all?** It's a top-3 reason people pick Easy Expense. My
   recommendation is still no — but it's the closest call in this plan.
