# Extraction eval corpus

This is the gate on the project. Build it before writing app code.

## What to shoot

**200 real receipts**, deliberately including the ugly ones. A corpus of clean flat
scans will tell you the product works and then production will tell you otherwise.

Aim for roughly:

| Kind | Count | Why |
|---|---:|---|
| Everyday clean (grocery, retail, coffee) | 60 | Baseline |
| Faded thermal paper | 25 | The single most common real-world failure |
| Crumpled / folded | 25 | |
| Angled, curled, or shadowed | 25 | Tests whether cropping actually matters |
| Restaurant with tip lines | 20 | Tip-vs-tax confusion is a known weak spot |
| Long itemized (grocery, warehouse) | 15 | Tests the token cap and line-item accuracy |
| **Foreign currency** | **20** | Load-bearing since design v2 — drives reimbursement amounts |
| Gas pump | 10 | Odd layouts, often no line items |

## Ground truth

For every `<id>.jpg`, hand-write `<id>.json`:

```json
{
  "vendor": "Starbucks",
  "receipt_date": "2026-07-03",
  "currency": "USD",
  "subtotal": "16.80",
  "tax": "1.43",
  "total": "18.23",
  "category": "Meals",
  "line_item_count": 3,
  "difficulty": "faded thermal, bottom third barely legible"
}
```

Money as decimal strings, matching the extraction schema. `null` where a field is
genuinely absent from the receipt — not where it's hard to read.

Labelling 200 of these is a tedious day and there is no shortcut worth taking. Every
threshold and model decision downstream rests on these numbers.

## Running

```bash
pnpm eval -- --limit 10                 # smoke test first, ~$0.05
pnpm eval                               # full run on the default model
pnpm eval -- --model gpt-5.6-terra      # compare
pnpm eval -- --model gpt-5.6-sol        # is frontier actually worth 5x?
```

Exits non-zero if any field misses its target. Per-run results and every failure
land in `eval/results/`.

## Targets

| Field | Target | Why |
|---|---:|---|
| total | 95% | The number that must never be wrong |
| currency | 98% | Drives FX → drives what someone gets paid |
| receipt_date | 93% | |
| vendor | 90% | Fuzzy match — "STARBUCKS #4521" counts as "Starbucks" |
| tax | 85% | Hardest field; multi-rate and inclusive-tax receipts are genuinely ambiguous |
| category | 80% | Improves on its own as vendor history accumulates |
| **calibration** | **98%** | Of receipts auto-accepted, how many were right. The trust number. |

Calibration is the one to watch. High field accuracy with poor calibration means the
app confidently shows people wrong numbers, which is worse than flagging more for
review.

Both `corpus/` and `results/` are gitignored — receipts contain personal financial
data and must not go into version control.
