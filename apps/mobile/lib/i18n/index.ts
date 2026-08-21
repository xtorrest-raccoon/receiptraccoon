import AsyncStorage from "@react-native-async-storage/async-storage";
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
 * untouched by this). Auto-detects from the phone's system language on
 * first launch, with a manual override persisted locally on-device (not
 * synced to the account — a language preference is a property of this
 * phone, not of the person's profile, same reasoning as the phone's own
 * system language setting).
 */
export const SUPPORTED_LANGUAGES = ["en", "fr", "es", "de", "pt", "it", "nl", "ja"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  ja: "日本語",
};

const resources = { en: { translation: en }, fr: { translation: fr }, es: { translation: es }, de: { translation: de }, pt: { translation: pt }, it: { translation: it }, nl: { translation: nl }, ja: { translation: ja } };

const STORAGE_KEY = "rr_language_override";

function isSupported(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/**
 * Best-effort match against the phone's ranked locale list (e.g. a phone set
 * to "fr-CA" should still land on our "fr" bundle, not fall through to
 * English) -- falls back to English when nothing supported is found, same
 * as an unset override.
 */
function detectDeviceLanguage(): SupportedLanguage {
  for (const locale of Localization.getLocales()) {
    if (isSupported(locale.languageCode ?? "")) return locale.languageCode as SupportedLanguage;
  }
  return "en";
}

/** Null return means "no override" — follow the device language. */
export async function getLanguageOverride(): Promise<SupportedLanguage | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored && isSupported(stored) ? stored : null;
}

/** Pass null to clear the override and go back to following the device's own language. */
export async function setLanguageOverride(language: SupportedLanguage | null): Promise<void> {
  if (language === null) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await i18n.changeLanguage(detectDeviceLanguage());
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, language);
    await i18n.changeLanguage(language);
  }
}

/**
 * Dev-only: every locale must carry exactly the keys English has (missing
 * keys silently fall back to English at runtime -- fine for users, but easy
 * to miss during review). Logs rather than throws, so a translation gap
 * never breaks the app for real users if this ever ran in production.
 */
function checkKeyParity(): void {
  if (!__DEV__) return;
  const keysOf = (obj: object, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object" ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  const englishKeys = new Set(keysOf(en));
  for (const [code, dict] of Object.entries(resources)) {
    if (code === "en") continue;
    // A language whose plural rules have only the "other" category (e.g.
    // Japanese) never needs a "_one" variant -- English's own "_one" keys
    // are correctly absent there, not a translation gap.
    const singleCategoryPlurals = new Intl.PluralRules(code).resolvedOptions().pluralCategories.length <= 1;
    const relevantEnglishKeys = singleCategoryPlurals
      ? [...englishKeys].filter((k) => !k.endsWith("_one"))
      : [...englishKeys];
    const theseKeys = new Set(keysOf(dict.translation));
    const missing = relevantEnglishKeys.filter((k) => !theseKeys.has(k));
    const extra = [...theseKeys].filter((k) => !englishKeys.has(k));
    if (missing.length) console.warn(`[i18n] ${code} is missing keys:`, missing);
    if (extra.length) console.warn(`[i18n] ${code} has extra keys not in en:`, extra);
  }
}

/** Call once at app startup, before the first render that needs translated text — see app/_layout.tsx. */
export async function initI18n(): Promise<void> {
  checkKeyParity();
  const override = await getLanguageOverride();
  await i18n.use(initReactI18next).init({
    resources,
    lng: override ?? detectDeviceLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React already escapes -- double-escaping would show "&amp;" literally.
    compatibilityJSON: "v4",
  });
}

export default i18n;
