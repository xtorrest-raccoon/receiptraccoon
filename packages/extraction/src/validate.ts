import { arithmeticChecks, parseMoneyToMinor, type ReceiptExtraction } from "@rr/shared";

/**
 * Deterministic validation.
 *
 * This matters more than the model choice. These checks are free, they never
 * hallucinate, and an arithmetic mismatch is a far stronger signal that something is
 * wrong than any confidence score. OCR_PLAN.md §3.
 *
 * Note also that OpenAI strict mode guarantees SHAPE, not semantics — it does not
 * enforce Zod refinements, `format`, `pattern`, or numeric bounds. Everything below
 * has to be checked here or not at all.
 */

export type ValidationSeverity = "hard" | "soft";

export interface ValidationIssue {
  field: string;
  severity: ValidationSeverity;
  message: string;
}

export interface ValidationOutcome {
  passed: boolean; // no hard failures
  issues: ValidationIssue[];
  /** True when escalating to a stronger model could plausibly help. */
  worthEscalating: boolean;
}

const MAX_FUTURE_DAYS = 2;
const MAX_AGE_YEARS = 3;

export function validateExtraction(
  data: ReceiptExtraction,
  opts: { homeCurrency: string; today?: Date } = { homeCurrency: "USD" },
): ValidationOutcome {
  const issues: ValidationIssue[] = [];
  const today = opts.today ?? new Date();
  const currency = data.currency ?? opts.homeCurrency;

  // Not a receipt, or unreadable — a second model call will not fix a blurry photo.
  if (!data.is_receipt) {
    return {
      passed: false,
      issues: [{ field: "is_receipt", severity: "hard", message: "Not a purchase receipt" }],
      worthEscalating: false,
    };
  }
  if (data.legibility === "poor") {
    return {
      passed: false,
      issues: [{ field: "legibility", severity: "hard", message: "Image is mostly unreadable" }],
      worthEscalating: false,
    };
  }

  const subtotal = parseMoneyToMinor(data.subtotal, currency);
  const tax = parseMoneyToMinor(data.tax, currency);
  const total = parseMoneyToMinor(data.total, currency);

  if (total === null) {
    issues.push({ field: "total", severity: "hard", message: "Total missing or unparseable" });
  } else if (total <= 0) {
    issues.push({ field: "total", severity: "hard", message: "Total must be positive" });
  }

  if (subtotal !== null && total !== null && !arithmeticChecks(subtotal, tax, total)) {
    issues.push({
      field: "total",
      severity: "hard",
      message: `Arithmetic mismatch: subtotal ${subtotal} + tax ${tax ?? 0} ≠ total ${total}`,
    });
  }

  // Date
  if (!data.receipt_date) {
    issues.push({ field: "receipt_date", severity: "hard", message: "Date missing" });
  } else {
    const parsed = new Date(`${data.receipt_date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      issues.push({ field: "receipt_date", severity: "hard", message: "Date unparseable" });
    } else {
      const daysAhead = (parsed.getTime() - today.getTime()) / 86_400_000;
      const yearsBack = (today.getTime() - parsed.getTime()) / (86_400_000 * 365);
      if (daysAhead > MAX_FUTURE_DAYS) {
        issues.push({ field: "receipt_date", severity: "hard", message: "Date is in the future" });
      } else if (yearsBack > MAX_AGE_YEARS) {
        issues.push({
          field: "receipt_date",
          severity: "soft",
          message: `Date is more than ${MAX_AGE_YEARS} years old`,
        });
      }
    }
  }

  // Currency. Load-bearing since design v2 — a misread currency means someone gets
  // paid the wrong amount, so foreign currency always goes to a human regardless of
  // how confident the model was. DESIGN_V2_DELTA.md §5.2.
  if (!data.currency) {
    issues.push({ field: "currency", severity: "hard", message: "Currency not detected" });
  } else if (!/^[A-Z]{3}$/.test(data.currency)) {
    issues.push({ field: "currency", severity: "hard", message: "Currency is not an ISO 4217 code" });
  } else if (data.currency !== opts.homeCurrency) {
    // Soft, not hard. Travel is a normal path for this product, not an edge case,
    // and forcing every foreign receipt through manual review would recreate the
    // tedium the app exists to remove.
    //
    // The protection against a MISREAD currency is the confidence score: currency
    // is one of the weakest-link critical fields, so low certainty already drags
    // the receipt into review on its own. What needs guarding at conversion time is
    // that an FX rate actually exists for the date — see convertMinor().
    issues.push({
      field: "currency",
      severity: "soft",
      message: `Foreign currency (${data.currency}) — will be converted to ${opts.homeCurrency}`,
    });
  }

  // Line items: partial capture is common and must not block the receipt.
  //
  // Compare against subtotal OR total, because the correct target depends on the
  // tax regime. In VAT-inclusive countries — i.e. most of Europe, our home market —
  // printed line prices are gross, so they sum to the TOTAL while `subtotal` is the
  // net-of-VAT figure. Checking only against subtotal flagged every German and
  // French receipt in the first run.
  if (data.line_items.length > 0) {
    const sum = data.line_items.reduce((acc, li) => {
      const qty = Number.parseFloat(li.quantity);
      const unit = parseMoneyToMinor(li.unit_price, currency);
      if (unit === null) return acc;
      // Quantity is frequently blank on service lines; treat it as 1.
      return acc + Math.round((Number.isNaN(qty) || qty === 0 ? 1 : qty) * unit);
    }, 0);

    const within = (target: number | null) =>
      target !== null && target > 0 && Math.abs(sum - target) / target <= 0.05;

    if (sum > 0 && !within(subtotal) && !within(total)) {
      issues.push({
        field: "line_items",
        severity: "soft",
        message: "Line items do not sum to either subtotal or total",
      });
    }
  }

  // Card identifiers are frequently masked on real receipts — French terminals print
  // "XX19", others print "**1234" or only the final two digits. Accept any of those
  // rather than discarding information we did successfully read.
  if (data.payment_last4 && !/^[0-9Xx*•#]{2,8}$/.test(data.payment_last4)) {
    issues.push({
      field: "payment_last4",
      severity: "soft",
      message: "Card identifier has an unexpected format",
    });
  }

  const hard = issues.filter((i) => i.severity === "hard");

  return {
    passed: hard.length === 0,
    issues,
    worthEscalating: hard.length > 0,
  };
}
