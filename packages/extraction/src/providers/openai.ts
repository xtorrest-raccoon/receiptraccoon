import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { buildReceiptExtractionSchema, ReceiptExtractionLoose } from "@rr/shared";
import { SYSTEM_PROMPT } from "../prompt.js";
import { CRITICAL_FIELDS, computeOverallConfidence, fieldConfidenceFromTokens } from "../confidence.js";
import {
  ExtractionError,
  type ExtractionProvider,
  type ExtractionRequest,
  type ExtractionResult,
} from "../types.js";

/** USD per 1M tokens. Verified against OpenAI's pricing page 2026-07-19. */
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 1.0, output: 6.0 },
  "gpt-5.6-terra": { input: 2.5, output: 15.0 },
  "gpt-5.6-sol": { input: 5.0, output: 30.0 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
};

const DEFAULT_MODEL = process.env.EXTRACTION_MODEL ?? "gpt-5.6-luna";

function costMinorUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  const dollars = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  return dollars * 100;
}

export class OpenAIExtractionProvider implements ExtractionProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set. Copy .env.example to .env.local.");
    }
    this.client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 0 });
  }

  async extract(req: ExtractionRequest): Promise<ExtractionResult> {
    const model = req.model ?? DEFAULT_MODEL;
    const started = Date.now();

    // Strict Structured Outputs requires a fixed enum in the request, and each
    // workspace has its own category list — so the schema is built per call.
    // DESIGN_V2_DELTA.md §5.1.
    const schema = buildReceiptExtractionSchema(req.categories);
    const base64 = req.image.toString("base64");

    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model,
        response_format: zodResponseFormat(schema, "receipt"),
        logprobs: true,
        temperature: 0, // transcription, not writing — no upside to sampling variance
        max_completion_tokens: 1500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract this receipt." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${req.mimeType};base64,${base64}`,
                  // Mandatory. On "low" the image is downsampled to 512px and line
                  // items become unreadable — the most common cause of bad
                  // receipt extraction.
                  detail: "high",
                },
              },
            ],
          },
        ],
      });
    } catch (err) {
      throw new ExtractionError(
        `OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`,
        isRetryable(err),
        err,
      );
    }

    const choice = completion.choices[0];
    if (!choice) throw new ExtractionError("No choices returned", true);

    if (choice.finish_reason === "length") {
      // A long grocery receipt can blow the token cap, and truncated JSON will not
      // parse. Surfaced explicitly rather than as a confusing parse error.
      throw new ExtractionError("Response truncated at max_completion_tokens", true);
    }

    const content = choice.message.content;
    if (!content) throw new ExtractionError("Empty response content", true);

    // Strict mode guarantees shape, not that the date is real or the total parses.
    // Always re-validate.
    let parsed;
    try {
      parsed = ReceiptExtractionLoose.parse(JSON.parse(content));
    } catch (err) {
      throw new ExtractionError("Response failed schema validation", true, err);
    }

    const tokens =
      choice.logprobs?.content?.map((t: { token: string; logprob: number }) => ({
        token: t.token,
        logprob: t.logprob,
      })) ?? [];
    const fieldConfidence = fieldConfidenceFromTokens(tokens, CRITICAL_FIELDS);

    const usage = completion.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    return {
      data: parsed,
      fieldConfidence,
      // Validation is folded in by the caller, which knows the workspace's home
      // currency; this is the pre-validation figure.
      overallConfidence: computeOverallConfidence({
        fieldConfidence,
        validationsPassed: true,
        legibility: parsed.legibility,
      }),
      provider: this.name,
      model,
      usage: {
        inputTokens,
        outputTokens,
        costMinor: costMinorUsd(model, inputTokens, outputTokens),
      },
      durationMs: Date.now() - started,
      raw: completion,
    };
  }
}

/**
 * Retry on rate limits and server errors. Never on 400 — a malformed schema request
 * fails identically every time and just burns the rate limit.
 */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === undefined) return true; // network/timeout
  return status === 429 || status >= 500;
}
