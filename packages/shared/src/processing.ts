import type { ProcessingSegment, ReceiptProcessing, ReimbursementStatus } from "./types.js";

/**
 * Receipt processing breakdown — replaces the earlier financial-health score.
 *
 * The health score needed two competing algorithms and a running argument about
 * what "healthy" even means. This is a fact, not a judgment: of everything
 * claimed in the window, how much sits in each stage of the reimbursement
 * pipeline. Nothing to disagree with.
 *
 * Fixed status order so the ring segments and the legend always draw in the same
 * sequence regardless of which statuses happen to be present.
 */
const STATUS_ORDER: readonly ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];

export interface ProcessingEntry {
  reimbursementStatus: ReimbursementStatus;
  /** The reclaim amount, not the receipt total — see reclaimMinor() in money.ts. */
  amountMinor: number;
}

/**
 * Pure aggregation over whatever entries the caller has already scoped to a
 * window (last 30 days) and a viewer (member sees own, admin sees workspace) —
 * this function does no date filtering or currency conversion itself, matching
 * the pattern of every other aggregate in this file.
 */
export function computeReceiptProcessing(
  entries: readonly ProcessingEntry[],
  windowDays = 30,
): ReceiptProcessing {
  const totals = new Map<ReimbursementStatus, number>();
  for (const status of STATUS_ORDER) totals.set(status, 0);
  for (const entry of entries) {
    totals.set(entry.reimbursementStatus, (totals.get(entry.reimbursementStatus) ?? 0) + entry.amountMinor);
  }

  const totalMinor = entries.reduce((sum, e) => sum + e.amountMinor, 0);

  const segments: ProcessingSegment[] = STATUS_ORDER.map((status) => {
    const amountMinor = totals.get(status) ?? 0;
    return { status, amountMinor, pct: totalMinor ? (amountMinor / totalMinor) * 100 : 0 };
  }).filter((s) => s.amountMinor > 0);

  return { windowDays, totalMinor, receiptCount: entries.length, segments };
}

/**
 * The one-line status caption shown under the ring.
 *
 * Deliberately currency-agnostic: it returns the DECISION (which case applies)
 * and the raw numbers, not a formatted sentence. Formatting the amount is left to
 * the caller, which knows the display currency — baking `formatMoney` in here
 * would mean this function needs a currency argument for something that is
 * otherwise pure aggregation, and every other figure in this app is formatted at
 * the UI layer, not inside the shared aggregate.
 *
 * Takes the already-computed ReceiptProcessing (not raw entries) specifically so
 * it can be called on the post-toHome-conversion segments each app already has —
 * calling it earlier, on EUR amounts, would silently mismatch the currency the
 * rest of the card is showing.
 */
export type ProcessingStatus =
  | { kind: "empty" }
  | { kind: "clear" }
  | { kind: "outstanding"; pct: number; amountMinor: number };

export function summarizeProcessingStatus(processing: ReceiptProcessing): ProcessingStatus {
  if (processing.segments.length === 0) return { kind: "empty" };

  const outstanding = processing.segments.filter(
    (s) => s.status === "pending" || s.status === "approved",
  );
  if (outstanding.length === 0) return { kind: "clear" };

  return {
    kind: "outstanding",
    pct: outstanding.reduce((sum, s) => sum + s.pct, 0),
    amountMinor: outstanding.reduce((sum, s) => sum + s.amountMinor, 0),
  };
}
