// Legal page drafts (mirror backend `legal_pages` seeds). Bodies are starter
// drafts to be reviewed by counsel before launch. Editable later via the admin CMS.
import type { Locale } from "@/lib/i18n";

export interface LegalDoc {
  slug: string;
  title: { en: string; hi: string };
  body: { en: string; hi: string };
}

const draft = (en: string) => ({ en, hi: en });

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    slug: "privacy",
    title: { en: "Privacy Policy", hi: "गोपनीयता नीति" },
    body: draft(
      "OnlyMyPDF is privacy-first. Client-side tools never upload your files. Server-side files are stored only temporarily and auto-delete after 1 hour. We store metadata only (file name, tool, size, status, credits, duration, coarse geo/device) and never keep your file contents or full extracted text. Raw IP addresses are hashed."
    ),
  },
  terms: {
    slug: "terms",
    title: { en: "Terms of Use", hi: "उपयोग की शर्तें" },
    body: draft(
      "By using OnlyMyPDF you agree to use the service lawfully, only process files you own or have permission to modify, and accept fair-usage limits. The service is provided as-is with no guarantee of 100% conversion accuracy."
    ),
  },
  refund: {
    slug: "refund",
    title: { en: "Refund Policy", hi: "रिफ़ंड नीति" },
    body: draft(
      "7-day refund for a first-time Pro purchase only, allowed if usage is below 100 standard credits and below the heavy-usage threshold. No refunds for heavy usage, abuse, completed high-cost conversions, or trial misuse."
    ),
  },
  "fair-usage": {
    slug: "fair-usage",
    title: { en: "Fair Usage Policy", hi: "उचित उपयोग नीति" },
    body: draft(
      "We offer large file support with fair-use protection. Limits (per plan) are configurable and exist to keep the service fast and affordable for everyone. Automated abuse, scraping, or sharing credentials may lead to suspension."
    ),
  },
  cookie: {
    slug: "cookie",
    title: { en: "Cookie Policy", hi: "कुकी नीति" },
    body: draft("We use essential cookies for sessions and security. Analytics are privacy-preserving and low-cost."),
  },
  "auto-delete": {
    slug: "auto-delete",
    title: { en: "Auto-delete Policy", hi: "ऑटो-डिलीट नीति" },
    body: draft(
      "All server-side input and output files auto-delete 1 hour after processing. You can delete instantly with the Delete Now button. After deletion, downloads are no longer available."
    ),
  },
  abuse: {
    slug: "abuse",
    title: { en: "Abuse / Malware Policy", hi: "दुरुपयोग / मैलवेयर नीति" },
    body: draft(
      "Uploading malware, illegal content, or files you have no right to process is prohibited. We perform basic safety validation and may block suspicious files."
    ),
  },
  "data-processing": {
    slug: "data-processing",
    title: { en: "Data Processing Policy", hi: "डेटा प्रोसेसिंग नीति" },
    body: draft(
      "Files are processed in isolated, temporary storage per job and deleted within 1 hour. AI/OCR intermediate text is deleted at job cleanup. We act as a data processor for the files you submit."
    ),
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS);

export function legalTitle(slug: string, locale: Locale) {
  return LEGAL_DOCS[slug]?.title[locale];
}
