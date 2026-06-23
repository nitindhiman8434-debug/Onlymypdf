import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import type { Tool } from "@/lib/tools";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://onlymypdf.com";
export const SITE_NAME = "OnlyMyPDF";
export const DEFAULT_TITLE = "OnlyMyPDF – Fast, Private PDF Tools";

/** Build canonical + hreflang alternates for a path that exists in both locales. */
export function alternates(path: string) {
  const clean = path === "/" ? "" : path;
  return {
    canonical: `${SITE_URL}${clean || "/"}`,
    languages: {
      en: `${SITE_URL}${clean || "/"}`,
      hi: `${SITE_URL}/hi${clean}`,
      "x-default": `${SITE_URL}${clean || "/"}`,
    },
  };
}

export function baseMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const url = locale === "hi" ? `${SITE_URL}/hi${path === "/" ? "" : path}` : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: alternates(path),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: locale === "hi" ? "hi_IN" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** schema.org JSON-LD for a tool page: SoftwareApplication + BreadcrumbList + FAQPage. */
export function toolJsonLd(tool: Tool, locale: Locale, faq: { q: string; a: string }[]) {
  const url =
    (locale === "hi" ? `${SITE_URL}/hi` : SITE_URL) + `/${tool.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: tool.name[locale],
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: tool.name[locale], item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}
