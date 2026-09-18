import type { Metadata } from "next";
import { LocalizedLegalDocument } from "@/components/marketing/legal/localized-legal-document";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Refund Policy",
  description:
    "Eligibility, review factors, and request steps for an OnlyMyPDF purchase refund.",
  path: "/refund",
});

export default function RefundPage() {
  return <LocalizedLegalDocument doc="refund" />;
}
