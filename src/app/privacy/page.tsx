import type { Metadata } from "next";
import { LocalizedLegalDocument } from "@/components/marketing/legal/localized-legal-document";
import { PrivacyGdprSections } from "@/components/marketing/privacy-gdpr-sections";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "How OnlyMyPDF processes files, account data, cookies, AI requests, payments, and privacy requests.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LocalizedLegalDocument doc="privacy" prepend={<PrivacyGdprSections />} />
  );
}
