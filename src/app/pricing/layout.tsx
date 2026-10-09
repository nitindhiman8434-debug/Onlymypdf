import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageAeoSummary } from "@/components/seo/page-aeo-summary";
import { JsonLd, pricingProProductJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing — Free & Pro PDF Tools Plans (India)",
  description:
    "Compare OnlyMyPDF Free and Pro plans for PDF tools, signing, and AI summaries. Review daily allowances, file limits, expiry rules, and checkout availability.",
  path: "/pricing",
  keywords: [
    "PDF tools pricing India",
    "OnlyMyPDF Pro plan",
    "free PDF tools online",
    "PDF to Word pricing",
    "AI PDF summarizer plan",
  ],
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={pricingProProductJsonLd()} />
      {children}
      <PageAeoSummary variant="pricing" />
    </>
  );
}
