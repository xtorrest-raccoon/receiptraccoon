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
  /**
   * True when receipt_date_raw was a numeric day/month date where the model's
   * own interpretation (receipt_date) doesn't match what the extracted
   * country's date-order convention implies -- see checkDateFormatAmbiguity.
   * Escalating to a stronger model will not fix this (it is not a reasoning
   * failure, the ambiguity is real), so index.ts caps receipt_date's field
   * confidence directly to route it to a human instead of a second AI call.
   */
  dateFormatAmbiguous: boolean;
}

const MAX_FUTURE_DAYS = 2;
const MAX_AGE_YEARS = 3;

/**
 * The well-established outlier: countries that conventionally print numeric
 * dates as MM/DD rather than DD/MM. Deliberately short and conservative --
 * only the US is included with real confidence; extend this list only on
 * actual evidence, since a wrong entry here would flag CORRECT dates as
 * mismatched instead of catching real errors.
 */
const MM_DD_COUNTRIES = new Set(["US"]);

/**
 * Cross-checks a numeric day/month date against the country's conventional
 * order. Returns null when there's nothing to check (no raw text, no
 * ambiguity — day > 12 on either side already disambiguates by construction,
 * or the model's own interpretation isn't a valid alternate reading of the
 * same two numbers), or the ISO date the country's convention implies when
 * that differs from what the model actually returned.
 *
 * Deliberately narrow: this only fires when we can PROVE two things at once
 * disagree (the model's own country field vs. its own date field) — never a
 * blanket "this date looks ambiguous" flag, which would trigger on roughly
 * 4 in 10 receipts by chance alone (any day-of-month ≤ 12) regardless of
 * whether the source format was ever actually ambiguous.
 */
function checkDateFormatAmbiguity(
  rawDate: string | null,
  isoDate: string,
  country: string | null,
): string | null {
  if (!rawDate) return null;

  // First two numeric groups in the raw text -- the day/month pair, whichever
  // order they were printed in. A 4-digit group is the year, never part of
  // the ambiguity, and its position (leading, as in YYYY-MM-DD) already
  // disambiguates the other two unambiguously, so only match when the first
  // two groups are both 1-2 digits.
  const match = rawDate.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a > 12 || b > 12 || a === b) return null; // unambiguous, or swap is a no-op

  const [, , isoMonth, isoDay] = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!isoMonth || !isoDay) return null;
  const modelMonth = Number(isoMonth);
  const modelDay = Number(isoDay);

  // The model's own reading has to actually be one of the two possible
  // readings of these exact two numbers -- if it's neither (e.g. it read the
  // year differently, or this raw text wasn't really the source of
  // receipt_date at all), there's nothing this check can safely say.
  const readAsDayMonth = modelDay === a && modelMonth === b;
  const readAsMonthDay = modelDay === b && modelMonth === a;
  if (!readAsDayMonth && !readAsMonthDay) return null;

  const countryExpectsMonthDay = country != null && MM_DD_COUNTRIES.has(country);
  const modelMatchesCountry = countryExpectsMonthDay ? readAsMonthDay : readAsDayMonth;
  if (modelMatchesCountry) return null;

  // Model's interpretation disagrees with its own country field -- report
  // what the country's convention would have produced instead.
  const year = isoDate.slice(0, 4);
  const expectedDay = countryExpectsMonthDay ? b : a;
  const expectedMonth = countryExpectsMonthDay ? a : b;
  return `${year}-${String(expectedMonth).padStart(2, "0")}-${String(expectedDay).padStart(2, "0")}`;
}

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
      dateFormatAmbiguous: false,
    };
  }
  if (data.legibility === "poor") {
    return {
      passed: false,
      issues: [{ field: "legibility", severity: "hard", message: "Image is mostly unreadable" }],
      worthEscalating: false,
      dateFormatAmbiguous: false,
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
  let dateFormatAmbiguous = false;
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

      const countryReading = checkDateFormatAmbiguity(data.receipt_date_raw, data.receipt_date, data.country);
      if (countryReading) {
        dateFormatAmbiguous = true;
        issues.push({
          field: "receipt_date",
          severity: "soft",
          message: `Ambiguous numeric date "${data.receipt_date_raw}" — ${data.country ?? "unknown country"}'s convention suggests ${countryReading}, not ${data.receipt_date}`,
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
    dateFormatAmbiguous,
  };
}
