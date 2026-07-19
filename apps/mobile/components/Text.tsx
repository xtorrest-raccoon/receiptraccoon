import { Text as RNText, type TextProps } from "react-native";

/**
 * Thin wrapper around RN's Text. The design specifies Inter, with -apple-system as
 * its fallback — on iOS that fallback (San Francisco) is what actually renders
 * without shipping font files, so this intentionally does not set a custom
 * `fontFamily` and lets RN use the system font. Centralised here so a real Inter
 * font load (via expo-font) is a one-file change later, not a hunt through every
 * screen.
 */
export function Text(props: TextProps) {
  return <RNText {...props} />;
}
