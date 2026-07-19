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
    issues.push({
      field: "currency",
      severity: "hard",
      message: `Foreign currency (${data.currency}) — requires review before conversion`,
    });
  }

  // Line items: partial capture is common and must not block the receipt.
  if (data.line_items.length > 0 && subtotal !== null) {
    const sum = data.line_items.reduce((acc, li) => {
      const qty = Number.parseFloat(li.quantity);
      const unit = parseMoneyToMinor(li.unit_price, currency);
      if (Number.isNaN(qty) || unit === null) return acc;
      return acc + Math.round(qty * unit);
    }, 0);
    if (subtotal > 0 && Math.abs(sum - subtotal) / subtotal > 0.05) {
      issues.push({
        field: "line_items",
        severity: "soft",
        message: "Line items do not sum to subtotal",
      });
    }
  }

  if (data.payment_last4 && !/^\d{4}$/.test(data.payment_last4)) {
    issues.push({ field: "payment_last4", severity: "soft", message: "last4 is not 4 digits" });
  }

  const hard = issues.filter((i) => i.severity === "hard");
  const onlyCurrencyMismatch =
    hard.length > 0 && hard.every((i) => i.field === "currency" && i.message.startsWith("Foreign"));

  return {
    passed: hard.length === 0,
    issues,
    // A foreign-currency receipt is correct, just requires review — re-running a
    // bigger model would burn money to reach the same answer.
    worthEscalating: hard.length > 0 && !onlyCurrencyMismatch,
  };
}
