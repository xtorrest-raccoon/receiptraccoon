import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import fr from "./locales/fr";
import es from "./locales/es";
import de from "./locales/de";
import pt from "./locales/pt";
import it from "./locales/it";
import nl from "./locales/nl";
import ja from "./locales/ja";

/**
 * UI localization for the mobile app only (see the web app's own copy,
 * untouched by this). Read once from the phone's system language when the
 * app starts — no manual override or persisted choice. If the phone's
 * language changes, the app picks it up next launch, matching how a
 * system-language setting behaves elsewhere.
 */
export const SUPPORTED_LANGUAGES = ["en", "fr", "es", "de", "pt", "it", "nl", "ja"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = { en: { translation: en }, fr: { translation: fr }, es: { translation: es }, de: { translation: de }, pt: { translation: pt }, it: { translation: it }, nl: { translation: nl }, ja: { translation: ja } };

function isSupported(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/**
 * Best-effort match against the phone's ranked locale list (e.g. a phone set
 * to "fr-CA" should still land on our "fr" bundle, not fall through to
 * English) -- falls back to English when nothing supported is found.
 */
function detectDeviceLanguage(): SupportedLanguage {
  for (const locale of Localization.getLocales()) {
    if (isSupported(locale.languageCode ?? "")) return locale.languageCode as SupportedLanguage;
  }
  return "en";
}

// Languages in SUPPORTED_LANGUAGES whose plural rules have only the "other"
// category (no "_one" variant is ever needed). Hardcoded rather than read
// from Intl.PluralRules: that API isn't reliably present on Hermes across
// devices, and this is a fixed fact about each language, not something that
// needs to be queried at runtime.
const SINGLE_CATEGORY_PLURAL_LANGUAGES: readonly SupportedLanguage[] = ["ja"];

/**
 * Dev-only: every locale must carry exactly the keys English has (missing
 * keys silently fall back to English at runtime -- fine for users, but easy
 * to miss during review). Wrapped in try/catch and never awaited by the
 * caller for a reason: this must never be able to block real app startup,
 * on this device or any other -- see the incident where an earlier version
 * of this used Intl.PluralRules, which isn't reliably present on Hermes and
 * crashed the whole app before it could render anything.
 */
function checkKeyParity(): void {
  if (!__DEV__) return;
  try {
    const keysOf = (obj: object, prefix = ""): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === "object" ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    const englishKeys = new Set(keysOf(en));
    for (const [code, dict] of Object.entries(resources)) {
      if (code === "en") continue;
      const singleCategoryPlurals = (SINGLE_CATEGORY_PLURAL_LANGUAGES as readonly string[]).includes(code);
      const relevantEnglishKeys = singleCategoryPlurals
        ? [...englishKeys].filter((k) => !k.endsWith("_one"))
        : [...englishKeys];
      const theseKeys = new Set(keysOf(dict.translation));
      const missing = relevantEnglishKeys.filter((k) => !theseKeys.has(k));
      const extra = [...theseKeys].filter((k) => !englishKeys.has(k));
      if (missing.length) console.warn(`[i18n] ${code} is missing keys:`, missing);
      if (extra.length) console.warn(`[i18n] ${code} has extra keys not in en:`, extra);
    }
  } catch (e) {
    console.warn("[i18n] key-parity check itself failed (non-fatal, skipping):", e);
  }
}

/** Call once at app startup, before the first render that needs translated text — see app/_layout.tsx. */
export async function initI18n(): Promise<void> {
  checkKeyParity();
  await i18n.use(initReactI18next).init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React already escapes -- double-escaping would show "&amp;" literally.
    compatibilityJSON: "v4",
  });
}

export default i18n;
