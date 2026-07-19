/**
 * Confidence scoring from token logprobs.
 *
 * Models are badly calibrated when asked to rate their own confidence — they report
 * high confidence on confident-sounding hallucinations, which is exactly the failure
 * mode we need to catch. Token probabilities are a genuinely better signal.
 * OCR_PLAN.md §4.
 */

export interface TokenLogprob {
  token: string;
  logprob: number;
}

/** Mean linear probability across a run of tokens. */
export function meanProbability(tokens: TokenLogprob[]): number {
  if (tokens.length === 0) return 0;
  const sum = tokens.reduce((acc, t) => acc + Math.exp(t.logprob), 0);
  return sum / tokens.length;
}

/**
 * Attribute logprobs to fields by walking the emitted JSON token stream and
 * tracking which key we are inside.
 *
 * Approximate by nature — token boundaries do not align to JSON structure. It is a
 * relative signal for routing, not a calibrated probability, and it should be
 * treated as one input among several rather than the answer.
 */
export function fieldConfidenceFromTokens(
  tokens: TokenLogprob[],
  fields: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const buffers = new Map<string, TokenLogprob[]>();

  let currentField: string | null = null;
  let sawColon = false;

  for (const tok of tokens) {
    const text = tok.token;

    const matched = fields.find((f) => text.includes(f));
    if (matched) {
      currentField = matched;
      sawColon = false;
      continue;
    }

    if (currentField && !sawColon && text.includes(":")) {
      sawColon = true;
      continue;
    }

    if (currentField && sawColon) {
      if (text.includes(",") || text.includes("}")) {
        currentField = null;
        sawColon = false;
        continue;
      }
      const buf = buffers.get(currentField) ?? [];
      buf.push(tok);
      buffers.set(currentField, buf);
    }
  }

  for (const field of fields) {
    const buf = buffers.get(field);
    out[field] = buf && buf.length > 0 ? meanProbability(buf) : 0.5; // unknown, not confident
  }
  return out;
}

export interface OverallConfidenceInput {
  fieldConfidence: Record<string, number>;
  validationsPassed: boolean;
  legibility: "clear" | "partial" | "poor";
}

/** Fields whose correctness actually matters for routing. */
export const CRITICAL_FIELDS = ["total", "receipt_date", "vendor", "currency"] as const;

/**
 * Weakest-link across the critical fields, not the mean.
 *
 * A receipt with a perfect vendor and a garbage total must not average out to
 * "fine" — the total is the whole point.
 */
export function computeOverallConfidence(input: OverallConfidenceInput): number {
  const critical = CRITICAL_FIELDS.map((f) => input.fieldConfidence[f] ?? 0.5);
  const weakest = Math.min(...critical);

  const legibilityScore =
    input.legibility === "clear" ? 1 : input.legibility === "partial" ? 0.5 : 0;

  const score =
    0.5 * weakest + 0.3 * (input.validationsPassed ? 1 : 0) + 0.2 * legibilityScore;

  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}
