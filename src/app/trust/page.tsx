import type { Metadata } from "next";
import { LocalizedLegalDocument } from "@/components/marketing/legal/localized-legal-document";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Trust Center",
  description:
    "OnlyMyPDF security controls, file expiry and cleanup, supported providers, and the limits of current verification.",
  path: "/trust",
});

export default function TrustPage() {
  return <LocalizedLegalDocument doc="trust" />;
}
