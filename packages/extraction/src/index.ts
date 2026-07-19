import { OpenAIExtractionProvider } from "./providers/openai.js";
import { computeOverallConfidence } from "./confidence.js";
import { validateExtraction, type ValidationOutcome } from "./validate.js";
import type { ExtractionProvider, ExtractionRequest, ExtractionResult } from "./types.js";

export * from "./types.js";
export * from "./validate.js";
export * from "./confidence.js";
export { SYSTEM_PROMPT } from "./prompt.js";
export { OpenAIExtractionProvider } from "./providers/openai.js";

export function getProvider(name = process.env.EXTRACTION_PROVIDER ?? "openai"): ExtractionProvider {
  switch (name) {
    case "openai":
      return new OpenAIExtractionProvider();
    default:
      throw new Error(`Unknown extraction provider: ${name}`);
  }
}

export interface ExtractOptions extends ExtractionRequest {
  homeCurrency: string;
  /** Below this, escalate once then route to needs_review. Calibrate from the eval set. */
  confidenceThreshold?: number;
  escalationModel?: string;
}

export interface ExtractOutcome {
  result: ExtractionResult;
  validation: ValidationOutcome;
  overallConfidence: number;
  status: "processed" | "needs_review";
  escalated: boolean;
  /** Combined cost of both attempts when escalation happened. */
  totalCostMinor: number;
}

/**
 * Run extraction with validation, confidence routing, and one escalation.
 *
 * Sonnet-tier model first, stronger model only when confidence is low or a
 * deterministic check failed — roughly 60% cheaper than always using the stronger
 * model. OCR_PLAN.md §1, §7.
 */
export async function extractReceipt(opts: ExtractOptions): Promise<ExtractOutcome> {
  const provider = getProvider();
  const threshold =
    opts.confidenceThreshold ??
    Number(process.env.EXTRACTION_CONFIDENCE_THRESHOLD ?? "0.85");
  const escalationModel =
    opts.escalationModel ?? process.env.EXTRACTION_ESCALATION_MODEL ?? "gpt-5.6-terra";

  const first = await provider.extract(opts);
  let validation = validateExtraction(first.data, { homeCurrency: opts.homeCurrency });
  let confidence = computeOverallConfidence({
    fieldConfidence: first.fieldConfidence,
    validationsPassed: validation.passed,
    legibility: first.data.legibility,
  });

  let result = first;
  let escalated = false;
  let totalCostMinor = first.usage.costMinor;

  const shouldEscalate =
    (confidence < threshold || !validation.passed) && validation.worthEscalating;

  if (shouldEscalate) {
    const second = await provider.extract({ ...opts, model: escalationModel });
    const secondValidation = validateExtraction(second.data, {
      homeCurrency: opts.homeCurrency,
    });
    const secondConfidence = computeOverallConfidence({
      fieldConfidence: second.fieldConfidence,
      validationsPassed: secondValidation.passed,
      legibility: second.data.legibility,
    });

    escalated = true;
    totalCostMinor += second.usage.costMinor;

    if (secondConfidence > confidence) {
      result = second;
      validation = secondValidation;
      confidence = secondConfidence;
    }
  }

  return {
    result,
    validation,
    overallConfidence: confidence,
    status: confidence >= threshold && validation.passed ? "processed" : "needs_review",
    escalated,
    totalCostMinor,
  };
}
