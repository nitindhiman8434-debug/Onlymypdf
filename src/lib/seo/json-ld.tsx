import { APP_DESCRIPTION, APP_NAME, APP_URL, PRO_PRICING, getToolBySlug } from "@/config/constants";
import { getToolSEO } from "@/config/tools";
import { getToolAeo } from "@/config/tool-aeo";
import type { HowToStep } from "@/types";

type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
  nonce?: string;
};

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data, nonce }: JsonLdProps) {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <script
      type="application/ld+json"
      {...(nonce ? { nonce } : {})}
      // Browsers strip the nonce attribute from the DOM after applying CSP, so
      // the hydrated client value ("") differs from the server value — this is
      // expected and must not trigger a hydration warning.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(payload.length === 1 ? payload[0] : payload),
      }}
    />
  );
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: APP_URL,
    description: APP_DESCRIPTION,
    logo: `${APP_URL}/opengraph-image`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${APP_URL}/contact`,
      availableLanguage: ["English", "Hindi"],
    },
    knowsAbout: [
      "PDF merge",
      "PDF split",
      "PDF compression",
      "PDF conversion",
      "PDF editing",
      "PDF security",
    ],
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: APP_URL,
    description: APP_DESCRIPTION,
    inLanguage: "en",
  };
}

export function webApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: APP_NAME,
    url: APP_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    description: APP_DESCRIPTION,
  };
}

export function pricingProProductJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${APP_NAME} Pro`,
    description: "Pro PDF tools plan with 100 daily uses, Sign PDF, AI summarizer, and priority processing.",
    brand: { "@type": "Brand", name: APP_NAME },
    offers: [
      {
        "@type": "Offer",
        name: "Pro Monthly",
        price: String(PRO_PRICING.monthlyInr),
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: `${APP_URL}/pricing`,
      },
      {
        "@type": "Offer",
        name: "Pro Yearly",
        price: String(PRO_PRICING.yearlyInr),
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: `${APP_URL}/pricing`,
      },
    ],
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${APP_URL}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

export function faqPageJsonLd(faqs: { question: string; answer: string }[]) {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function howToJsonLd(slug: string, name: string, steps: HowToStep[]) {
  if (steps.length === 0) return null;
  const pageUrl = !slug || slug === "home" ? APP_URL : `${APP_URL}/${slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to use ${name}`,
    description: getToolAeo(slug)?.definition ?? `Steps to use ${name} on ${APP_NAME}.`,
    url: pageUrl,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      url: `${pageUrl}#step-${index + 1}`,
    })),
    tool: {
      "@type": "HowToTool",
      name: APP_NAME,
    },
  };
}

export function webPageJsonLd(slug: string, title: string, description: string) {
  const pageUrl = !slug || slug === "home" ? APP_URL : `${APP_URL}/${slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", name: APP_NAME, url: APP_URL },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#aeo-short-answer", "#aeo-summary"],
    },
  };
}

export function softwareApplicationJsonLd(slug: string) {
  const seo = getToolSEO(slug);
  const tool = getToolBySlug(slug);
  const name = seo?.h1 ?? tool?.name ?? slug;
  const description = seo?.metaDescription ?? tool?.description ?? APP_DESCRIPTION;

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url: `${APP_URL}/${slug}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    description,
  };
}

export function ToolJsonLd({ slug }: { slug: string }) {
  const seo = getToolSEO(slug);
  const aeo = getToolAeo(slug);
  const tool = getToolBySlug(slug);
  const label = tool?.name ?? seo?.h1 ?? slug.replace(/-/g, " ");
  const description = seo?.metaDescription ?? aeo?.shortAnswer ?? APP_DESCRIPTION;

  const schemas: Record<string, unknown>[] = [
    webPageJsonLd(slug, seo?.h1 ?? label, description),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Tools", path: "/all-tools" },
      { name: label, path: `/${slug}` },
    ]),
    softwareApplicationJsonLd(slug),
  ];

  const howToSchema = aeo ? howToJsonLd(slug, seo?.h1 ?? label, aeo.howToSteps) : null;
  if (howToSchema) schemas.push(howToSchema);

  const faqSchema = seo?.faqs ? faqPageJsonLd(seo.faqs) : null;
  if (faqSchema) schemas.push(faqSchema);

  return <JsonLd data={schemas} />;
}
