import { TextInput as RNTextInput, type TextInputProps } from "react-native";

/**
 * Thin wrapper around RN's TextInput — same reasoning as components/Text.tsx.
 * `allowFontScaling` defaults to false so typed values (dates, amounts) stay
 * inside their fixed-width fields regardless of the phone's OS "Text Size"
 * setting; without this, the exact same "2026-07-02" that fits fine on one
 * phone gets tail-truncated to "2026-07..." on another, purely from OS-level
 * scaling, not anything to do with actual screen width.
 */
export function TextInput({ allowFontScaling = false, ...props }: TextInputProps) {
  return <RNTextInput allowFontScaling={allowFontScaling} {...props} />;
}
