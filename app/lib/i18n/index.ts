export type Locale = "es" | "en" | "pt";
export const SUPPORTED_LOCALES: Locale[] = ["es", "en", "pt"];
export const DEFAULT_LOCALE: Locale = "es";

export type TranslationKey = keyof typeof import("./es").default;

const dictionaries: Record<Locale, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import("./es"),
  en: () => import("./en"),
  pt: () => import("./pt"),
};

/** Load translations for a given locale */
export async function loadTranslations(locale: Locale): Promise<Record<string, string>> {
  const mod = await dictionaries[locale]();
  return mod.default;
}

/** Detect locale from: user pref > org default > Accept-Language header > default */
export function detectLocale(options: {
  userPref?: string | null;
  orgDefault?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  const { userPref, orgDefault, acceptLanguage } = options;

  // 1. User preference
  if (userPref && SUPPORTED_LOCALES.includes(userPref as Locale)) {
    return userPref as Locale;
  }

  // 2. Organization default
  if (orgDefault && SUPPORTED_LOCALES.includes(orgDefault as Locale)) {
    return orgDefault as Locale;
  }

  // 3. Browser Accept-Language header
  if (acceptLanguage) {
    const browserLangs = acceptLanguage.split(",").map((l) => l.split(";")[0].trim().slice(0, 2));
    for (const lang of browserLangs) {
      if (SUPPORTED_LOCALES.includes(lang as Locale)) {
        return lang as Locale;
      }
    }
  }

  return DEFAULT_LOCALE;
}
