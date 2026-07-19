import type { DistanceUnit } from "@rr/shared";

/**
 * Miles <-> kilometres. This is a physical constant, not business logic, so it
 * lives here rather than in `@rr/shared` (which owns money, categories, health —
 * things that must not drift between web and mobile).
 */
export const MI_TO_KM = 1.60934;

export function convertDistance(distance: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return distance;
  return from === "mi" ? distance * MI_TO_KM : distance / MI_TO_KM;
}

export function formatDistance(distance: number, unit: DistanceUnit): string {
  return `${distance.toFixed(1)} ${unit}`;
}

/**
 * Convert a per-mile (or per-km) reimbursement rate, still in integer minor
 * units, to the equivalent rate in the other unit. Stays in minor units the
 * whole way through so the result can still be handed to `formatMoney` —
 * nothing here divides a minor amount into major units by hand.
 */
export function convertRateMinor(rateMinor: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return rateMinor;
  return Math.round(from === "mi" ? rateMinor / MI_TO_KM : rateMinor * MI_TO_KM);
}
