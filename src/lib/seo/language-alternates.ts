import { stripLocalePrefix } from "@/lib/i18n/locale-path";
import { absoluteUrl } from "@/lib/seo/metadata";

/** Only published English pages are eligible for canonical/hreflang links. */
export function buildLanguageAlternates(path: string) {
  const basePath = stripLocalePrefix(path.split(/[?#]/)[0] ?? path);
  const canonical = absoluteUrl(basePath);

  return {
    canonical,
    languages: {
      en: canonical,
      "x-default": canonical,
    },
  };
}
