import { Text as RNText, type TextProps } from "react-native";

/**
 * Thin wrapper around RN's Text. The design specifies Inter, with -apple-system as
 * its fallback — on iOS that fallback (San Francisco) is what actually renders
 * without shipping font files, so this intentionally does not set a custom
 * `fontFamily` and lets RN use the system font. Centralised here so a real Inter
 * font load (via expo-font) is a one-file change later, not a hunt through every
 * screen.
 *
 * `allowFontScaling` defaults to false: every screen is laid out against the
 * fixed point sizes in @rr/ui-tokens, and RN's default (follow the OS "Text
 * Size" accessibility setting) meant the exact same layout rendered
 * noticeably bigger on one phone than another — labels that fit fine at the
 * design's own scale started wrapping or looking oversized purely because
 * that one device had a larger text-size setting. Any screen that genuinely
 * wants OS scaling can still opt back in via the prop.
 */
export function Text({ allowFontScaling = false, ...props }: TextProps) {
  return <RNText allowFontScaling={allowFontScaling} {...props} />;
}
