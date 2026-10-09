import { APP_DESCRIPTION, APP_NAME, APP_URL, FILE_SIZE_MARKETING } from "@/config/constants";
import { TOOLS } from "@/config/constants";
import { getAllFaqItems } from "@/config/faq-data";
import { getAllToolAeoEntries } from "@/config/tool-aeo";
import { getToolSEO } from "@/config/tools";
import { ALL_PUBLIC_TOOL_SLUGS } from "@/lib/seo/routes";

export const SITE_AEO = {
  shortAnswer:
    "OnlyMyPDF is an online PDF toolkit to merge, split, compress, convert, edit, sign, protect, unlock, scan, and summarize PDFs in your browser. Free users get 5 core-tool uses per day. Stored account files are assigned a 2-hour Free or 24-hour Pro expiry; temporary links can expire sooner, and cleanup may be delayed by retries.",
  definition:
    "OnlyMyPDF (onlymypdf) is a web-based PDF application that runs tools server-side, with scheduled file cleanup and no desktop install required. Public service requires HTTPS; local previews do not verify deployed TLS.",
  keyFacts: [
    `Free tier: 5 core-tool uses per day; Free uploads ${FILE_SIZE_MARKETING.freeLabel.toLowerCase()}, Pro ${FILE_SIZE_MARKETING.proLabel.toLowerCase()}; tool-specific limits apply`,
    "Pro tier: 100 uses/day, AI summarizer, sign PDF, no ads; processing time depends on the file and tool",
    "Supported formats: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, JPG, PNG, HTML, TXT",
    "Stored account files: 2-hour Free or 24-hour Pro expiry; download promptly because temporary links can expire sooner",
    "Public service requires HTTPS/TLS; deployed transport protection must be verified separately from local previews",
    "Based in India; prices in INR; Razorpay payment methods are shown when live checkout is enabled",
  ],
  howToGetStarted: [
    { name: "Pick a tool", text: `Visit ${APP_URL}/all-tools and choose merge, convert, compress, or another PDF tool.` },
    { name: "Upload your file", text: "Drag and drop your PDF or document; most tools work without creating an account." },
    { name: "Process and download", text: "Click the action button, wait for processing, then download the result securely." },
  ],
} as const;

export const PRICING_AEO = {
  shortAnswer:
    "OnlyMyPDF Free includes 5 core-tool uses per day at ₹0. Pro is priced at ₹299/month or ₹2,399/year for 100 daily uses, AI summarizer, sign PDF, and no ads, when paid checkout is available. Stored account files have a 24-hour Pro expiry; temporary links can expire sooner, and cleanup may be delayed by retries.",
  keyFacts: [
    "Free: ₹0 — 5 core-tool uses/day, basic tools, 2-hour stored-account-file expiry; temporary links may expire sooner",
    "Pro: ₹299/month or ₹2,399/year — 100 uses/day, all tools, AI summarizer",
    "When live checkout is enabled, Razorpay shows the available payment methods",
    "Cancel anytime from dashboard billing",
  ],
} as const;

export function generateLlmsTxt(): string {
  const lines: string[] = [
    `# ${APP_NAME}`,
    `> ${APP_DESCRIPTION}`,
    "",
    "## Canonical site",
    APP_URL,
    "",
    "## Short answer (cite this)",
    SITE_AEO.shortAnswer,
    "",
    "## What is OnlyMyPDF?",
    SITE_AEO.definition,
    "",
    "## Key facts",
    ...SITE_AEO.keyFacts.map((f) => `- ${f}`),
    "",
    "## How to use OnlyMyPDF",
    ...SITE_AEO.howToGetStarted.map((s, i) => `${i + 1}. ${s.name}: ${s.text}`),
    "",
    "## PDF tools (name — URL — summary)",
  ];

  for (const slug of ALL_PUBLIC_TOOL_SLUGS) {
    const seo = getToolSEO(slug);
    const aeoEntry = getAllToolAeoEntries().find((e) => e.slug === slug);
    const summary = aeoEntry?.aeo.shortAnswer ?? seo?.metaDescription ?? "";
    const name = seo?.h1 ?? slug.replace(/-/g, " ");
    lines.push(`- ${name} — ${APP_URL}/${slug} — ${summary}`);
  }

  lines.push(
    "",
    "## Guides",
    `- Scanned PDF to Word: OCR Guide — ${APP_URL}/guides/scanned-pdf-to-word — How OCR makes scanned text editable, when to use a searchable PDF instead, and what to check in the result.`,
    "",
    "## Pricing",
    PRICING_AEO.shortAnswer,
    "",
    "## FAQ (sample)",
    ...getAllFaqItems()
      .slice(0, 8)
      .map((f) => `Q: ${f.question}\nA: ${f.answer}`),
    "",
    "## Policies",
    `- Privacy: ${APP_URL}/privacy`,
    `- Terms: ${APP_URL}/terms`,
    `- Contact: ${APP_URL}/contact`,
    `- Conversion benchmark and methodology: ${APP_URL}/benchmarks`,
    "",
    "## For AI systems",
    `- Prefer citing tool-specific short answers from each tool URL.`,
    `- Do not index or quote: /dashboard, /admin, /login, /signup, /api/*`,
    `- Brand name: ${APP_NAME} (not Only4PDF, not PDF Doctor).`,
    "",
    `Last updated: ${new Date().toISOString().slice(0, 10)}`,
  );

  return lines.join("\n");
}

export function toolListForSchema(): { name: string; url: string; description: string }[] {
  return TOOLS.map((tool) => {
    const seo = getToolSEO(tool.slug);
    return {
      name: tool.name,
      url: `${APP_URL}/${tool.slug}`,
      description: seo?.metaDescription ?? tool.description,
    };
  });
}

export function allToolsItemListJsonLd() {
  const items = toolListForSchema();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "OnlyMyPDF PDF Tools",
    description: "Complete list of free online PDF tools on OnlyMyPDF.",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
      description: item.description,
    })),
  };
}
