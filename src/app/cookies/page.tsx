import type { Metadata } from "next";
import { LocalizedLegalDocument } from "@/components/marketing/legal/localized-legal-document";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Cookie Policy",
  description:
    "The essential browser storage OnlyMyPDF uses and how to manage optional cookie preferences.",
  path: "/cookies",
});

export default function CookiesPage() {
  return <LocalizedLegalDocument doc="cookies" />;
}
