import type { Metadata } from "next";
import { LocalizedLegalDocument } from "@/components/marketing/legal/localized-legal-document";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Refund Policy",
  description:
    "OnlyMyPDF refund policy — eligibility and how to request a refund for Pro purchases.",
  path: "/refund",
});

export default function RefundPage() {
  return <LocalizedLegalDocument doc="refund" />;
}
