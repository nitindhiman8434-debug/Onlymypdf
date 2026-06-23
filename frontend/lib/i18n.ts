// ============================================================
// OnlyMyPDF — lightweight i18n. English is the default at the
// root; Hindi mirrors live under /hi/ with the SAME English slugs
// (e.g. /compress-pdf and /hi/compress-pdf). Admin is English only.
// ============================================================
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";

export type Locale = "en" | "hi";
export const LOCALES: Locale[] = ["en", "hi"];
export const DEFAULT_LOCALE: Locale = "en";

const catalogs: Record<Locale, Record<string, any>> = { en, hi };

/** Resolve a dotted key like "hero.headline" for a locale, falling back to en. */
export function t(locale: Locale, key: string): string {
  const read = (cat: Record<string, any>) =>
    key.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), cat);
  return read(catalogs[locale]) ?? read(catalogs.en) ?? key;
}

/** Build a locale-aware href. Hindi pages are prefixed with /hi. */
export function localeHref(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === "hi" ? `/hi${clean === "/" ? "" : clean}` : clean;
}

/** Pick the localized value from a {en, hi} pair. */
export function pick<T>(locale: Locale, pair: { en: T; hi: T }): T {
  return pair[locale];
}
