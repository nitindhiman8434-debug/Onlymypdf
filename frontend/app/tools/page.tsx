import type { Metadata } from "next";
import { ToolsPage } from "@/components/pages/ToolsPage";
import { baseMetadata } from "@/lib/seo";

export const metadata: Metadata = baseMetadata(
  "en",
  "/tools",
  "All PDF Tools",
  "Every OnlyMyPDF tool: convert, compress, merge, sign, scan, OCR, translate, and AI — fast and private."
);

export default function Page() {
  return <ToolsPage locale="en" />;
}
