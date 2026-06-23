import type { Metadata } from "next";
import { PricingPage } from "@/components/pages/PricingPage";
import { baseMetadata } from "@/lib/seo";

export const metadata: Metadata = baseMetadata(
  "en",
  "/pricing",
  "Pricing – 2100 monthly credits",
  "Simple, fair pricing. Start free, upgrade to Pro for 2100 monthly credits, larger files, OCR, and AI."
);

export default function Page() {
  return <PricingPage locale="en" />;
}
