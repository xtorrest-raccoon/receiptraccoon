import { z } from "zod";

/**
 * Extraction contract. One definition, four uses: it constrains the OpenAI
 * response, types both apps, validates API request bodies, and shapes the eval
 * harness's ground truth.
 *
 * Money arrives as decimal STRINGS, never JSON numbers — see money.ts for why.
 */

export const LineItemExtraction = z.object({
  description: z.string(),
  quantity: z.string(),
  unit_price: z.string(),
});

/** Fields that never vary by workspace. */
const baseExtractionShape = {
  vendor: z.string().nullable(),
  receipt_date: z.string().nullable(), // ISO YYYY-MM-DD, the model's own interpretation
  // As printed, verbatim, before any interpretation (e.g. "03/07/2026") -- lets
  // deterministic validation cross-check an ambiguous numeric date against the
  // extracted country's date-order convention. Null when the receipt spells the
  // date out unambiguously (a month name, or no date at all) rather than misused
  // as "no date" -- receipt_date itself remains the field that means that.
  receipt_date_raw: z.string().nullable(),
  currency: z.string().nullable(), // ISO 4217
  // ISO 3166-1 alpha-2. Informational (CSV/reporting) only — not in the
  // confidence object below, unlike currency, since nothing reimbursement-
  // critical reads it.
  country: z.string().nullable(),
  subtotal: z.string().nullable(),
  tax: z.string().nullable(),
  total: z.string().nullable(),
  payment_brand: z.string().nullable(),
  payment_last4: z.string().nullable(),
  payment_type: z.enum(["credit", "debit", "cash", "other"]).nullable(),
  line_items: z.array(LineItemExtraction),
  is_receipt: z.boolean(),
  legibility: z.enum(["clear", "partial", "poor"]),
  notes: z.string().nullable(),
  /**
   * Model's own 0–1 confidence per critical field.
   *
   * Second choice. The original design used token logprobs, which are better
   * calibrated, but the gpt-5.6 family does not support the `logprobs` parameter.
   * Self-reported confidence is weakly calibrated — models report high confidence
   * on confident-sounding mistakes — so deterministic validation carries the
   * larger weight in routing. See confidence.ts.
   */
  confidence: z.object({
    vendor: z.number(),
    receipt_date: z.number(),
    total: z.number(),
    currency: z.number(),
  }),
};

/**
 * Build the extraction schema for a specific workspace.
 *
 * The category enum CANNOT be a compile-time constant. Design v2 lets each
 * workspace add and remove categories, and OpenAI strict Structured Outputs
 * requires the enum to be fixed *in the request* — so the schema is constructed
 * per call from that workspace's current category list.
 * See DESIGN_V2_DELTA.md §5.1.
 */
export function buildReceiptExtractionSchema(categories: readonly string[]) {
  if (categories.length === 0) {
    throw new Error("Cannot build extraction schema with an empty category list");
  }
  return z.object({
    ...baseExtractionShape,
    category: z.enum(categories as [string, ...string[]]),
  });
}

/** Structural type of an extraction, independent of which categories a workspace has. */
export const ReceiptExtractionLoose = z.object({
  ...baseExtractionShape,
  category: z.string(),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionLoose>;
export type LineItemExtractionT = z.infer<typeof LineItemExtraction>;

/** Per-field confidence derived from token logprobs, not model self-report. */
export const FieldConfidence = z.object({
  vendor: z.number().min(0).max(1),
  receipt_date: z.number().min(0).max(1),
  total: z.number().min(0).max(1),
  currency: z.number().min(0).max(1),
});
export type FieldConfidenceT = z.infer<typeof FieldConfidence>;

// ── API request bodies ──────────────────────────────────────

export const PatchReceiptBody = z.object({
  vendor: z.string().min(1).max(200).optional(),
  receiptDate: z.iso.date().optional(),
  categoryId: z.uuid().nullable().optional(),
  subtotalMinor: z.number().int().optional(),
  taxMinor: z.number().int().optional(),
  totalMinor: z.number().int().positive().optional(),
  comment: z.string().max(2000).nullable().optional(),
  paymentBrand: z.string().max(50).nullable().optional(),
  paymentLast4: z.string().regex(/^[0-9Xx*•#]{2,8}$/).nullable().optional(),
});
export type PatchReceiptBodyT = z.infer<typeof PatchReceiptBody>;

export const SetReimbursementStatusBody = z.object({
  status: z.enum(["pending", "approved", "reimbursed", "rejected"]),
  // Required by the API when status is "rejected"; enforced in the handler so the
  // error message can name the field rather than failing an opaque refinement.
  reason: z.string().max(1000).optional(),
});

export const CreateMileageTripBody = z.object({
  tripDate: z.iso.date(),
  purpose: z.string().min(1).max(200),
  distance: z.number().positive().max(10000),
  distanceUnit: z.enum(["mi", "km"]),
});

export const ListReceiptsQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  categoryId: z.uuid().optional(),
  userId: z.uuid().optional(),
  status: z.enum(["uploading", "processing", "needs_review", "processed", "failed"]).optional(),
  reimbursementStatus: z.enum(["pending", "approved", "reimbursed", "rejected"]).optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
