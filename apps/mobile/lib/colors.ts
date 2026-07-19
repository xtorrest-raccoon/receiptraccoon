/**
 * oklch() -> React Native colour conversion.
 *
 * `@rr/ui-tokens` and `@rr/shared` (categories.ts) hand back colour strings like
 * `"oklch(56% 0.14 152)"` or `"oklch(93% 0.05 152 / 40%)"`. Those are valid CSS and
 * render fine on the web app, but React Native's StyleSheet has no idea what
 * `oklch()` means — it only accepts hex/rgb/rgba/hsl strings. This module is the
 * one place that bridges the gap, so no component ever hand-copies a colour.
 *
 * The math is Björn Ottosson's OKLab -> linear sRGB transform (the same one behind
 * the CSS Color 4 spec), followed by the sRGB gamma curve. Implemented locally
 * (no extra dependency) because it's ~20 lines and exact.
 */

const OKLCH_RE =
  /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%?\s*)?\)/i;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function srgbGamma(c: number): number {
  const cc = clamp01(c);
  return cc <= 0.0031308 ? 12.92 * cc : 1.055 * Math.pow(cc, 1 / 2.4) - 0.055;
}

/** L in [0,1], C (chroma), H in degrees -> {r,g,b} each in [0,1]. */
function oklchToSrgb(L: number, C: number, hDeg: number): { r: number; g: number; b: number } {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return {
    r: srgbGamma(rLin),
    g: srgbGamma(gLin),
    b: srgbGamma(bLin),
  };
}

function toHex(n: number): string {
  const v = Math.round(clamp01(n) * 255);
  return v.toString(16).padStart(2, "0");
}

const cache = new Map<string, string>();

/**
 * Convert a single `oklch(L% C H)` or `oklch(L% C H / A%)` string to a React
 * Native colour string (`#rrggbb` or `rgba(r,g,b,a)`).
 *
 * Anything that isn't a recognisable oklch() string (already a hex/rgb value,
 * "#fff", "transparent", etc.) is passed through unchanged, so this can safely
 * wrap every colour reference without a conditional at every call site.
 */
export function rn(colorString: string): string {
  const cached = cache.get(colorString);
  if (cached) return cached;

  const match = OKLCH_RE.exec(colorString);
  if (!match) return colorString;

  const lPct = parseFloat(match[1]!);
  const c = parseFloat(match[2]!);
  const h = parseFloat(match[3]!);
  const alphaPct = match[4] !== undefined ? parseFloat(match[4]!) : undefined;

  const { r, g, b } = oklchToSrgb(lPct / 100, c, h);
  const result =
    alphaPct !== undefined
      ? `rgba(${Math.round(clamp01(r) * 255)}, ${Math.round(clamp01(g) * 255)}, ${Math.round(clamp01(b) * 255)}, ${clamp01(alphaPct / 100)})`
      : `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  cache.set(colorString, result);
  return result;
}

/** Convenience for building an rgba() overlay from an oklch colour + explicit alpha. */
export function rnAlpha(colorString: string, alpha: number): string {
  const match = OKLCH_RE.exec(colorString);
  if (!match) return colorString;
  const lPct = parseFloat(match[1]!);
  const c = parseFloat(match[2]!);
  const h = parseFloat(match[3]!);
  const { r, g, b } = oklchToSrgb(lPct / 100, c, h);
  return `rgba(${Math.round(clamp01(r) * 255)}, ${Math.round(clamp01(g) * 255)}, ${Math.round(clamp01(b) * 255)}, ${clamp01(alpha)})`;
}
