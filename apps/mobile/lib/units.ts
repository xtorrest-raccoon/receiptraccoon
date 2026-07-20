import { MI_TO_KM, type DistanceUnit } from "@rr/shared";

/**
 * Re-exported from @rr/shared rather than defined here.
 *
 * It was previously a local constant on the grounds that a physical constant is
 * not business logic. That was wrong: it converts distances that get multiplied by
 * a per-mile rate, so it IS part of the money calculation, and having a second copy
 * is how the km/mile reimbursement bug survived.
 */
export { MI_TO_KM };

export function convertDistance(distance: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return distance;
  return from === "mi" ? distance * MI_TO_KM : distance / MI_TO_KM;
}

export function formatDistance(distance: number, unit: DistanceUnit): string {
  return `${distance.toFixed(1)} ${unit}`;
}

/**
 * Convert a per-mile (or per-km) reimbursement rate between units.
 *
 * Rates are integer thousandths of a currency unit, not minor units — statutory
 * mileage rates carry three decimals and rounding to cents would change what
 * someone is owed. Converting mi -> km at cent precision was especially lossy:
 * €0.700/mi is €0.435/km, and only the third decimal keeps that honest.
 */
export function convertRateMilli(rateMilli: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return rateMilli;
  return Math.round(from === "mi" ? rateMilli / MI_TO_KM : rateMilli * MI_TO_KM);
}
