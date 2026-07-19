/**
 * The seed category set and its colour mapping, lifted verbatim from the design
 * files (`ReceiptRaccoon Dashboard.dc.html` / `Mobile.dc.html`) so web and mobile
 * render identical chips.
 *
 * Note these are SEED categories only. As of design v2 each workspace can add and
 * remove its own, so nothing may treat this list as closed — see
 * DESIGN_V2_DELTA.md §5.1 for why this matters to the extraction schema.
 */

export const SEED_CATEGORIES = [
  "Meals",
  "Groceries",
  "Travel",
  "Office Supplies",
  "Software",
  "Fuel",
  "Utilities",
  "Marketing",
  "Professional Services",
  "Other",
] as const;

export type SeedCategory = (typeof SEED_CATEGORIES)[number];

export const CATEGORY_HUES: Record<string, number> = {
  Meals: 40,
  Groceries: 150,
  Travel: 230,
  "Office Supplies": 285,
  Software: 262,
  Fuel: 22,
  Utilities: 195,
  Marketing: 340,
  "Professional Services": 305,
  Other: 250,
};

const DEFAULT_HUE = 250;
const NEUTRAL_NAME = "Other";

export function hueFor(category: string): number {
  return CATEGORY_HUES[category] ?? DEFAULT_HUE;
}

/**
 * Deterministic hue for a user-created category, so custom categories get a
 * stable colour without needing one stored. Same name always yields same hue.
 */
export function derivedHue(category: string): number {
  if (category in CATEGORY_HUES) return CATEGORY_HUES[category]!;
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) % 360;
  return h;
}

/** Chip background (light) / text (dark). Matches the design's catColor(). */
export function categoryChipColor(category: string, light: boolean): string {
  const hue = derivedHue(category);
  if (category === NEUTRAL_NAME) {
    return light ? `oklch(93% 0.006 ${hue})` : `oklch(46% 0.01 ${hue})`;
  }
  return light ? `oklch(93% 0.05 ${hue})` : `oklch(42% 0.13 ${hue})`;
}

/** Solid accent for bars and dots. Matches the design's catAccent(). */
export function categoryAccent(category: string): string {
  const hue = derivedHue(category);
  if (category === NEUTRAL_NAME) return `oklch(60% 0.02 ${hue})`;
  return `oklch(60% 0.13 ${hue})`;
}
