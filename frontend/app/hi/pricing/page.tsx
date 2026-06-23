import type { Metadata } from "next";
import { PricingPage } from "@/components/pages/PricingPage";
import { baseMetadata } from "@/lib/seo";

export const metadata: Metadata = baseMetadata(
  "hi",
  "/pricing",
  "मूल्य – हर महीने 2100 क्रेडिट",
  "सरल और उचित मूल्य। मुफ़्त शुरू करें, प्रो में हर महीने 2100 क्रेडिट, बड़ी फ़ाइलें, OCR और एआई पाएँ।"
);

export default function Page() {
  return <PricingPage locale="hi" />;
}
