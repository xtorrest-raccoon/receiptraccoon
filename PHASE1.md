# Phase 1 — build brief

Read this before writing any app code. It is the contract that keeps the web and
mobile tracks from drifting apart.

---

## The rule

**Never re-derive anything that already exists in `packages/`.**

Colours, category hues, money formatting, the health score, status labels,
permission checks — all already written and typechecked. If you find yourself
writing `oklch(56% 0.14 152)` or a `formatCurrency` helper in app code, stop and
import it instead. Divergence between the two apps is the failure mode this whole
structure exists to prevent.

| Need | Import from |
|---|---|
| Types (`Receipt`, `MileageTrip`, `TeamResponse`…) | `@rr/shared` |
| Money formatting, dates, initials, payment method | `@rr/shared` |
| Category colours and hues | `@rr/shared` |
| Health score | `@rr/shared` |
| Who can approve / see the Team page | `@rr/shared` (`authz.ts`) |
| Colours, radii, type scale, chips | `@rr/ui-tokens` |
| Data | `@rr/mock-api` |

## Data comes from `@rr/mock-api`

Supabase is not provisioned yet. Both apps build against an in-memory API that
returns **exactly** the shapes the real endpoints will return.

```ts
import { getDashboard, listReceipts, getTeam, listMileage } from "@rr/mock-api";
```

Wrap every call in a thin per-app data module (`lib/data.ts`) so swapping to the real
API later touches one file, not every screen. Do not import `@rr/mock-api` directly
into components.

## Money

Every amount is an **integer count of minor units** (cents). `1250` is €12.50.
Format with `formatMoney(minor, currency)`. Never divide by 100 in a component, and
never do arithmetic on a formatted string.

## Design source

- `design/dashboard.dc.html` — web
- `design/mobile.dc.html` — mobile

These are the specification. Match spacing, radii, weights, and colours exactly. The
markup uses a custom template syntax (`sc-for`, `sc-if`, `{{ }}`) — read it as a
description of structure, not as code to port. The `<script>` block at the bottom
holds the layout logic worth understanding.

**The mockups' own data and helper functions are superseded.** They hardcode USD and
a fixed category list; we are EUR-based with per-workspace categories. Take the
*visual* spec from the design and the *data* from `@rr/mock-api`.

## Home currency is EUR

The business is euro-based and travels, so foreign receipts are normal. Where a
receipt has `originalCurrency`, show the FX line the design specifies in the receipt
drawer. Never assume USD.

## Responsive (web only)

The design has no media queries and is desktop-only. Agreed rules, from
`@rr/ui-tokens`'s `breakpoint`:

- `< 640px` — stat cards 2×2, charts stack full width, tables become stacked cards
- `< 1024px` — sidebar collapses to a top bar

This is additive. Do not change the desktop layout to achieve it.

## Authorization affects what renders

- Members see **only their own** receipts, and **no Team page at all**
- Only admins get the reimbursement dropdown; members see a read-only badge
- Use `canViewTeamPage(role)` and `canSetReimbursementStatus(ctx)` from `@rr/shared`

`@rr/mock-api` already scopes its data by role, mirroring the real RLS. Switch the
signed-in user with `setCurrentUser("u_2")` to test member views.

## Definition of done

- `pnpm typecheck` passes from the repo root
- Every screen in the assigned design renders with real mock data
- No hardcoded colours, currency symbols, or duplicated helpers
- Loading and empty states exist for every list
- Nothing imports `@rr/mock-api` outside `lib/data.ts`
