/**
 * Confidence scoring.
 *
 * ORIGINAL PLAN (OCR_PLAN.md §4): derive confidence from token logprobs, because
 * models are badly calibrated when asked to rate themselves — they report high
 * confidence on confident-sounding hallucinations.
 *
 * REALITY: the gpt-5.6 family rejects the `logprobs` parameter outright (400).
 * Verified 2026-07-19 against the live API.
 *
 * SO: we use the model's per-field self-report, but weight it *below* deterministic
 * validation, which cannot hallucinate. An arithmetic check that subtotal + tax
 * equals total is worth more than any number the model reports about itself.
 *
 * The practical consequence is that the confidence threshold must be calibrated
 * against the real corpus rather than reasoned about — see the calibration measure
 * in the eval harness.
 */

export interface OverallConfidenceInput {
  /** Model's own 0–1 estimates. Treated as a weak signal. */
  fieldConfidence: Record<string, number>;
  validationsPassed: boolean;
  legibility: "clear" | "partial" | "poor";
}

/** Fields whose correctness actually matters for routing. */
export const CRITICAL_FIELDS = ["total", "receipt_date", "vendor", "currency"] as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/**
 * Weakest-link across the critical fields, not the mean.
 *
 * A receipt with a perfect vendor and a garbage total must not average out to
 * "fine" — the total is the whole point.
 */
export function computeOverallConfidence(input: OverallConfidenceInput): number {
  const critical = CRITICAL_FIELDS.map((f) => clamp01(input.fieldConfidence[f] ?? 0.5));
  const weakest = Math.min(...critical);

  const legibilityScore =
    input.legibility === "clear" ? 1 : input.legibility === "partial" ? 0.5 : 0;

  // Deterministic validation carries the most weight — it is the only input here
  // that cannot be wrong about itself.
  const score =
    0.45 * (input.validationsPassed ? 1 : 0) + 0.35 * weakest + 0.2 * legibilityScore;

  return Math.round(clamp01(score) * 100) / 100;
}

/** Normalise the model's self-reported block into a flat record. */
export function toFieldConfidence(
  reported: { vendor: number; receipt_date: number; total: number; currency: number },
): Record<string, number> {
  return {
    vendor: clamp01(reported.vendor),
    receipt_date: clamp01(reported.receipt_date),
    total: clamp01(reported.total),
    currency: clamp01(reported.currency),
  };
}
