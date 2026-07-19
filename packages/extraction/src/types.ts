import type { ReceiptExtraction } from "@rr/shared";

/**
 * Provider-agnostic extraction interface.
 *
 * This exists so the eval harness can run OpenAI, Anthropic, and a purpose-built
 * vendor against the same corpus and pick on evidence rather than assumption
 * (OCR_PLAN.md §6, §8). It also means a provider outage degrades to a fallback
 * instead of an incident.
 */

export interface ExtractionRequest {
  image: Buffer;
  mimeType: string;
  /** This workspace's current category names — the strict enum is built from these. */
  categories: readonly string[];
  model?: string;
}

export interface ExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  /** Minor units of USD. Fractional — a single receipt costs well under one cent. */
  costMinor: number;
}

export interface ExtractionResult {
  data: ReceiptExtraction;
  /** Derived from token logprobs where the provider exposes them. */
  fieldConfidence: Record<string, number>;
  overallConfidence: number;
  provider: string;
  model: string;
  usage: ExtractionUsage;
  durationMs: number;
  raw: unknown;
}

export interface ExtractionProvider {
  readonly name: string;
  extract(req: ExtractionRequest): Promise<ExtractionResult>;
}

export class ExtractionError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ExtractionError";
    this.retryable = retryable;
  }
}
