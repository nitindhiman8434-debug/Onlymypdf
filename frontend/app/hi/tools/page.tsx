import type { Metadata } from "next";
import { ToolsPage } from "@/components/pages/ToolsPage";
import { baseMetadata } from "@/lib/seo";

export const metadata: Metadata = baseMetadata(
  "hi",
  "/tools",
  "सभी PDF टूल्स",
  "OnlyMyPDF के सभी टूल्स: कन्वर्ट, कंप्रेस, मर्ज, साइन, स्कैन, OCR, अनुवाद और एआई — तेज़ और निजी।"
);

export default function Page() {
  return <ToolsPage locale="hi" />;
}
