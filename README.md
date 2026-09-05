# Claimeo Pro

Receipt capture on iOS, expense management on the web. Employees photograph receipts
and log mileage; admins approve and reimburse.

## Documents

| | |
|---|---|
| [PLAN.md](PLAN.md) | Product roadmap and competitive positioning |
| [BUILD_PLAN.md](BUILD_PLAN.md) | Stack, backend architecture, agent workflow |
| [OCR_PLAN.md](OCR_PLAN.md) | Extraction pipeline (OpenAI), cost model, eval targets |
| [DESIGN_V2_DELTA.md](DESIGN_V2_DELTA.md) | Design v2 changes + the authorization model |

## Layout

```
packages/
  shared/       types, Zod contracts, money, formatting, health score, authz rules
  db/           SQL migrations, RLS policies, reimbursement trigger
  extraction/   OpenAI provider, validation, confidence scoring, eval harness
apps/           (not yet built — Phase 1)
  web/          Next.js dashboard
  mobile/       Expo iOS app
```

`packages/shared` is the contract layer. Both apps and the backend depend on it, and
it exists so "both apps share the same database" also means "both apps agree about
what the data means."

## Setup

```bash
pnpm install
cp .env.example .env.local     # then fill in OPENAI_API_KEY
pnpm typecheck
```

Requires Node 22+. Verified on Node 24.18, pnpm 11.15.

## Extraction

```bash
pnpm eval -- --limit 10        # smoke test, ~$0.05
pnpm eval                      # full corpus run
```

The eval corpus is the gate on the project — see
[packages/extraction/eval/README.md](packages/extraction/eval/README.md) for what to
shoot and how to label it. Both `eval/corpus/` and `eval/results/` are gitignored:
receipts contain personal financial data and must never enter version control.

## Ground rules

Three that are load-bearing rather than stylistic:

- **Money is always integer minor units.** Never a float, anywhere. `packages/shared/money.ts`
  is the only place that converts.
- **Reimbursement authority is enforced in Postgres**, not in an API route. Mobile,
  web, and any future integration all write to the same database; a check in one
  route handler protects one path. See `0001_init.sql`.
- **Rates are frozen at write time.** FX rates and mileage rates are stored per row
  and never recomputed, so a receipt's value cannot drift after the fact.
