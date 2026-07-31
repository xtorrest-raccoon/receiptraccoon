/**
 * ISO 3166-1 alpha-2 -> flag emoji, via the regional-indicator-symbol trick
 * (each letter maps to its own emoji codepoint, and the pair renders as one
 * flag glyph). No image assets or lookup table needed. Renders as two
 * letters instead of a flag on a handful of older Android builds that don't
 * ship the regional-indicator font data -- an acceptable tradeoff for now.
 */
export function flagEmoji(alpha2: string): string {
  const code = alpha2.toUpperCase();
  if (code.length !== 2) return "";
  const points = [...code].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  if (points.some((p) => p < 0x1f1e6 || p > 0x1f1ff)) return "";
  return String.fromCodePoint(...points);
}
