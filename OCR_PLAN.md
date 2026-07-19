# ReceiptRaccoon — OCR / Extraction with the OpenAI API

> Supersedes §2.4 of [BUILD_PLAN.md](BUILD_PLAN.md) (which specced Claude).
> Last updated: 2026-07-19

---

## 0. On the provider choice

You picked OpenAI, and for this particular job that's a well-founded choice — I'm not talking
you out of it. Two features make it arguably the better fit for receipt extraction specifically:

- **Strict Structured Outputs.** `strict: true` with a JSON Schema is a hard guarantee that the
  response matches your schema — no missing keys, no invented enum values, no "```json" wrapper
  to strip. For a pipeline writing straight into a financial database, that's worth a lot.
- **Logprobs.** You can get token-level probabilities, which is a genuinely better-calibrated
  confidence signal than asking a model to rate its own confidence. More on this in §4 — it's
  the single highest-leverage detail in this document.

The architecture from BUILD_PLAN.md is unchanged. The provider sits behind one interface (§6),
so this is a swap of one module, not a rewrite.

---

## 1. Model selection

Current lineup and pricing, pulled from OpenAI's docs today (not from memory — this moves fast,
so re-check before you finalize budgets):

| Model | Input / 1M | Cached in | Output / 1M | Role here |
|---|---:|---:|---:|---|
| `gpt-5.6-luna` | $1.00 | $0.10 | $6.00 | **Default extractor** — cost-optimized, vision-capable |
| `gpt-5.6-terra` | $2.50 | $0.25 | $15.00 | **Escalation** on low confidence or failed validation |
| `gpt-5.6-sol` | $5.00 | $0.50 | $30.00 | Frontier. Reserve for the eval harness ground-truth baseline |
| `gpt-5.4-nano` | $0.20 | $0.02 | $1.25 | Too weak for line-item extraction; possible pre-filter (§7) |

**Recommendation: `gpt-5.6-luna` as the workhorse, escalate to `gpt-5.6-terra` when confidence
is low or arithmetic validation fails.** Roughly 85% of receipts should clear on Luna.

Don't default to Sol. Receipt extraction is a well-structured perception task, not a reasoning
task — the frontier model's advantage is small here and it costs 5× more. Prove you need it
with the eval harness (§8) rather than assuming.

### Cost per receipt

A receipt photo at `detail: "high"` runs ~1,500 image tokens; instructions ~500; structured
output with line items ~500.

| Path | Math | Cost |
|---|---|---:|
| Luna only | (2,000 × $1 + 500 × $6) / 1M | **$0.0050** |
| Escalated to Terra | above + (2,000 × $2.50 + 500 × $15) / 1M | **$0.0175** |
| **Blended @ 15% escalation** | | **~$0.007** |

At 200 receipts/user/month that's **~$1.40/user/month**, or 14% of a $9.99 Pro subscription —
inside the 20%-of-ARPU ceiling PLAN.md set. Healthy.

⚠️ **One caveat on caching:** OpenAI's prompt caching generally needs a shared prefix of ~1,024+
tokens to engage. Our instruction block is ~500 tokens, so it likely **won't** cache as-is. Two
options: pad the system prompt with genuinely useful few-shot examples to push past the
threshold (which improves accuracy anyway, so it's not wasted tokens), or just accept it — the
savings are ~$0.0005/receipt either way. Don't architect around it.

---

## 2. The extraction schema

This is the contract. It lives in `packages/shared/schemas.ts` as Zod and converts to OpenAI's
JSON Schema via the SDK's `zodResponseFormat` helper — so **the same schema validates the
extraction, types both apps, and validates the API request body.** One definition, four uses.

```ts
// packages/shared/schemas.ts
import { z } from "zod";

export const CATEGORIES = [
  "Meals", "Groceries", "Travel", "Office Supplies", "Software",
  "Fuel", "Utilities", "Marketing", "Professional Services", "Other",
] as const;

const LineItem = z.object({
  description: z.string(),
  quantity:    z.string(),   // decimal-as-string, e.g. "2"
  unit_price:  z.string(),   // decimal-as-string, e.g. "5.60"
});

export const ReceiptExtraction = z.object({
  vendor:         z.string().nullable(),
  receipt_date:   z.string().nullable(),        // ISO 8601 "YYYY-MM-DD"
  currency:       z.string().nullable(),        // ISO 4217
  subtotal:       z.string().nullable(),        // "88.12"
  tax:            z.string().nullable(),
  total:          z.string().nullable(),
  payment_brand:  z.string().nullable(),        // "Visa"
  payment_last4:  z.string().nullable(),        // "4521"
  payment_type:   z.enum(["credit","debit","cash","other"]).nullable(),
  category:       z.enum(CATEGORIES),
  line_items:     z.array(LineItem),
  is_receipt:     z.boolean(),                  // false → user photographed a napkin
  legibility:     z.enum(["clear","partial","poor"]),
  notes:          z.string().nullable(),        // model's own caveats
});
```

### Three decisions in there worth defending

**Money as decimal strings, not numbers.** If the schema says `number`, the model emits JSON
floats and you inherit every float rounding problem in a financial app. Strings parse cleanly to
integer cents server-side with `decimal.js`. Non-negotiable.

**`is_receipt` and `legibility`.** Users photograph the wrong thing constantly. A cheap explicit
signal beats trying to infer "this extraction is garbage" from field values afterward.

**Everything `.nullable()` rather than `.optional()`.** This is a **strict-mode requirement**,
and it's the gotcha that trips everyone on their first Structured Outputs build:

> In `strict: true` mode, **every property must be listed in `required`**, and
> `additionalProperties: false` must be set on every object. There is no such thing as an
> optional field. Model "this might be absent" as `type: ["string", "null"]`.

Strict mode also **ignores or rejects** a lot of familiar JSON Schema vocabulary — `minimum`,
`maximum`, `pattern`, `format`, `minLength`. So `z.string().regex(...)` or `z.number().min(0)`
will not be enforced by the API. **Validate those yourself after parsing** (§3, step 4). Assuming
strict mode enforces your Zod refinements is a silent-data-corruption bug waiting to happen.

---

## 3. Pipeline

Unchanged in shape from BUILD_PLAN.md §2.4, with the OpenAI specifics filled in:

```
1  fetch image from Supabase Storage
2  downscale to ~1600px long edge, strip EXIF, JPEG q0.8
3  sha256 → duplicate check (same workspace, ±3 days, same total) → flag
4  OpenAI call — gpt-5.6-luna, strict structured output, detail:"high", logprobs on
5  deterministic validation (below)
6  if confidence < threshold OR validation fails → retry once on gpt-5.6-terra
7  categorize: workspace vendor history → global map → model's suggestion → "Other"
8  write receipts + receipt_line_items + extractions (append-only, with cost + tokens)
9  status = passed ? 'processed' : 'needs_review'
10 Supabase Realtime broadcast → mobile Processing screen advances to Confirm
```

### Step 5 — deterministic validation

This matters more than the model choice. These checks are free, they never hallucinate, and
they catch the failures that actually hurt:

| Check | Action on failure |
|---|---|
| `subtotal + tax == total` (±1¢) | Hard fail → escalate |
| `total > 0` | Hard fail → escalate |
| `receipt_date` parses and is within `[today − 3y, today + 2d]` | Flag date field |
| `sum(line_items) ≈ subtotal` (±5%) | Flag line items only — partial line-item capture is common and shouldn't block the receipt |
| `is_receipt == false` or `legibility == "poor"` | Straight to `needs_review`, skip escalation — a second model call won't fix a blurry photo |
| `category` in the 10 known values | Guaranteed by strict mode, but assert anyway |

An arithmetic mismatch is a much stronger signal that something's wrong than any confidence
score. Weight it accordingly.

---

## 4. Confidence — use logprobs, not self-reporting

BUILD_PLAN.md's Claude version had the model self-report per-field confidence. **With OpenAI you
can do better, and you should.** Models are famously badly calibrated when asked to rate
themselves — they report high confidence on confident-sounding hallucinations, which is exactly
the failure mode you need to catch.

Instead, request `logprobs: true` and derive per-field confidence from the actual token
probabilities of the tokens that produced each field's value:

```ts
// Mean linear probability across the tokens spanning a field's value.
// Low mean = the model was genuinely uncertain while emitting that number.
function fieldConfidence(tokens: Logprob[]): number {
  const probs = tokens.map(t => Math.exp(t.logprob));
  return probs.reduce((a, b) => a + b, 0) / probs.length;
}
```

Then combine into the routing decision:

```
overall = 0.5 × min(confidence of total, date, vendor)      ← weakest link, not average
        + 0.3 × (deterministic validations passed ? 1 : 0)
        + 0.2 × (legibility === "clear" ? 1 : legibility === "partial" ? 0.5 : 0)

overall ≥ 0.85  → 'processed'
overall <  0.85 → escalate once, then 'needs_review'
```

Use the **minimum** across critical fields rather than the mean. A receipt with a perfect vendor
and a garbage total should not average out to "fine" — the total is the whole point.

**Calibrate the 0.85 threshold against your eval set (§8), don't guess it.** It's the dial that
trades user annoyance (too many review prompts) against silent wrong data (worse). Start
conservative — over-flagging is recoverable, wrong numbers in someone's tax filing are not.

---

## 5. Implementation

```ts
// packages/extraction/src/openai-provider.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ReceiptExtraction } from "@rr/shared/schemas";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You extract structured data from photographs of retail and business receipts.

Rules:
- Transcribe only what is visibly printed. Never infer, complete, or guess a value.
- If a field is not legible or not present, return null. Do not estimate.
- Monetary values: plain decimal strings, no currency symbols or thousands separators ("1234.56").
- Dates: ISO 8601 YYYY-MM-DD. If the year is absent, infer from context; if ambiguous, return null.
- Ambiguous date formats: prefer the locale implied by the receipt's language and currency.
- subtotal excludes tax; total includes it. If only the total is printed, set subtotal to null
  rather than back-computing it.
- Tips are not tax. If a tip line exists, exclude it from tax and note it in "notes".
- line_items: only itemized product/service lines. Never include subtotal, tax, total,
  discounts, or loyalty lines as items.
- is_receipt: false if this is not a purchase receipt (menu, invoice, business card, random photo).
- legibility: "clear" fully readable · "partial" some fields obscured · "poor" mostly unreadable.
- category: choose the single best fit from the enum for a small-business expense context.
`.trim();

export async function extractReceipt(imageBase64: string, model = "gpt-5.6-luna") {
  const started = Date.now();

  const res = await openai.chat.completions.create({
    model,
    response_format: zodResponseFormat(ReceiptExtraction, "receipt"),  // strict: true
    logprobs: true,
    temperature: 0,          // deterministic. This is transcription, not writing.
    max_completion_tokens: 1500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: [
        { type: "text", text: "Extract this receipt." },
        { type: "image_url", image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
            detail: "high",     // required — line items are small text
        }},
      ]},
    ],
  });

  return {
    data:       ReceiptExtraction.parse(JSON.parse(res.choices[0].message.content!)),
    logprobs:   res.choices[0].logprobs,
    model,
    usage:      res.usage,
    durationMs: Date.now() - started,
  };
}
```

**Notes on the parameters:**
- `temperature: 0` — this is transcription. There is no upside to sampling variance.
- `detail: "high"` — mandatory. On `"low"` the image is downsampled to 512px and receipt line
  items become unreadable. This is the most common cause of bad receipt extraction.
- Still `.parse()` the response despite strict mode. Strict guarantees *shape*, not that
  `receipt_date` is a real date or that `subtotal` parses as a decimal.
- `max_completion_tokens: 1500` caps a runaway on a long grocery receipt. Handle the truncation
  case — a Costco receipt with 60 line items will hit it, and truncated JSON fails `.parse()`.

### Preprocessing

```ts
// Client-side, before upload (expo-image-manipulator)
resize to 1600px long edge · JPEG quality 0.8 · strip EXIF

// Server-side, before the API call
auto-orient · if median luminance < 60, apply contrast stretch
```

Skip aggressive binarization/deskewing. Vision models handle angled, curled, and shadowed
receipts far better than classical OCR did, and heavy preprocessing typically *loses* information
these models were using. Resize and orient; stop there.

---

## 6. Keep the provider swappable

Don't couple the pipeline to OpenAI. One interface, providers behind it:

```ts
// packages/extraction/src/types.ts
export interface ExtractionProvider {
  name: string;
  extract(image: Buffer, opts?: { model?: string }): Promise<{
    data: ReceiptExtraction;
    fieldConfidence: Record<string, number>;
    usage: { inputTokens: number; outputTokens: number; costCents: number };
    durationMs: number;
  }>;
}
```

`packages/extraction/src/providers/{openai,anthropic,veryfi,mindee}.ts`, selected by
`EXTRACTION_PROVIDER` env var.

This is not hedging for its own sake — it's what makes §8 possible. You cannot know which
provider is best for *your* receipts without running them side by side on your own corpus, and
you want that comparison to be a config change rather than a refactor. It also means a provider
outage degrades to a fallback instead of an incident.

---

## 7. Cost controls

| Lever | Saving | Notes |
|---|---|---|
| **sha256 dedupe cache** | 100% on re-uploads | Same image → return stored extraction. Free. Do it first. |
| **Luna-first, escalate on low confidence** | ~60% vs Terra-always | The core lever |
| **`gpt-5.4-nano` pre-filter** | avoids wasted extractions | One cheap "is this a receipt, is it legible?" call before the real one. Only worth it if telemetry shows >10% junk uploads — measure before building. |
| **Batch API** | 50% | 24h turnaround, so useless for live capture. Ideal for bulk re-processing when you improve the prompt. |
| **`max_completion_tokens` cap** | bounds worst case | |
| **Per-workspace daily ceiling** | abuse protection | Someone uploading 10k images shouldn't be able to run up your bill |

Write `input_tokens`, `output_tokens`, and `cost_cents` to the `extractions` table on **every**
call. You want per-user cost visible in week one, not discovered in an invoice.

---

## 8. The eval harness — build this first

PLAN.md §Phase 0 made extraction accuracy the gate on the whole project. This is that gate.

**Corpus:** 200 real receipts you photograph yourself — deliberately including the hard ones.
Faded thermal paper. Crumpled. Angled. Poor lighting. Restaurant receipts with tip lines.
Multi-page. Gas pumps. Foreign currency. Handwritten totals. If your corpus is 200 clean flat
scans, it will tell you the product works and then production will tell you otherwise.

**Ground truth:** hand-label all 200 into JSON. It's a tedious day of work and there's no
shortcut worth taking — every threshold and model decision downstream rests on it.

**Measure per field:**

| Field | Target | Rationale |
|---|---:|---|
| `total` | **≥ 95%** exact | The number that must never be wrong |
| `receipt_date` | ≥ 93% exact | |
| `vendor` | ≥ 90% fuzzy (normalized) | "STARBUCKS #4521" ≈ "Starbucks" should count as correct |
| `tax` | ≥ 85% exact | Hardest field — multi-rate and inclusive-tax receipts are genuinely ambiguous |
| `category` | ≥ 80% | Improves on its own as vendor history accumulates |
| line items | ≥ 75% (count + sum) | |

**Also measure, and don't skip these two:**
- **Calibration** — of the receipts auto-marked `processed`, what % were actually correct?
  This is the number that determines whether users can trust the app. Target ≥98%.
- **Cost per receipt** — actual, blended, from the `extractions` table.

**Run the matrix:** `gpt-5.6-luna` vs `terra` vs `sol`, and — since it's one config change (§6) —
against Claude and one purpose-built vendor (Veryfi or Mindee). ~$5 of API spend total for all
of it. Then pick on evidence about *your* receipts instead of anyone's blog post, including this
one.

---

## 9. Practicalities

**Secrets.** `OPENAI_API_KEY` is server-side only, in the Inngest function's environment. It must
never reach `apps/mobile` or `apps/web` client bundles — an API key shipped in an app binary is
extractable by anyone who downloads it. The mobile app uploads to Supabase Storage and calls
`POST /api/receipts/:id/process`; it never talks to OpenAI directly.

**Rate limits.** Tier-dependent. Inngest's concurrency control caps in-flight extractions;
exponential backoff on 429.

**Retries.** Retry on 429 and 5xx. **Do not retry on 400** — a malformed schema request will fail
identically every time and just burns your rate limit.

**Data handling.** API data is not used for training by default, but confirm the current terms
before you put customer receipts through it, and say what you do in your privacy policy.
Receipts contain names, card last-4s, addresses, and purchase history — this is exactly the
category of data a user will be angry about if it's handled loosely, and it's a genuine
competitive point if you handle it well.

**Timeouts.** 60s hard cap. A hung extraction should surface as `failed` with a retry, not leave
the mobile Processing screen spinning forever. The mockup's Processing screen assumes 1.4
seconds; real extractions run 3–8s, and the slow tail is longer — that screen needs a "still
working…" state at ~10s and a graceful failure at 60s.

---

## 10. Next steps

1. **You:** OpenAI API key with billing enabled, and a rough sense of which tier you're on
2. **You:** photograph ~200 receipts (this is the long pole — start now, it's the gate)
3. **Me:** `packages/extraction` scaffold, OpenAI provider, Zod schema, eval harness
4. **Me:** run the model matrix, report accuracy + cost per field
5. **Together:** set the confidence threshold from real calibration data
6. **Then:** wire into Inngest and the mobile capture flow

Steps 3–4 are the natural first delegation from BUILD_PLAN.md §4 — the harness itself is
mechanical (Sonnet 5), the prompt and threshold work is judgment (Opus 4.8).
