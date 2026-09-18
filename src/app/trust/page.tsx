import type { Metadata } from "next";
import { LocalizedLegalDocument } from "@/components/marketing/legal/localized-legal-document";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Trust Center",
  description:
    "Verified OnlyMyPDF security controls, retention limits, provider disclosures, and compliance status.",
  path: "/trust",
});

export default function TrustPage() {
  return <LocalizedLegalDocument doc="trust" />;
}
