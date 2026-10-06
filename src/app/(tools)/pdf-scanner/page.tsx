"use client";

import Link from "next/link";
import { ToolPageShell } from "@/components/layout/tool-page-shell";
import { PdfScannerWorkspace } from "@/components/tools/lazy-workspaces";
import { mapFaqs, mapRelatedTools } from "@/components/tools/tool-helpers";
import { SCANNER_MAX_IMAGES } from "@/config/pdf-scanner";
import { planFileSizeFaqLine } from "@/lib/billing/billing-copy";

const RELATED_TOOLS = [
  { name: "JPG to PDF", href: "/jpg-to-pdf" },
  { name: "Compress PDF", href: "/compress-pdf" },
  { name: "Merge PDF", href: "/merge-pdf" },
  { name: "PDF to Word", href: "/pdf-to-word" },
];

const FAQS = [
  {
    q: "Can I scan multiple pages into one PDF?",
    a: `Yes. Add up to ${SCANNER_MAX_IMAGES} images total per PDF on any plan, including all camera captures and uploads. Each image becomes one page in the order shown in the page strip. JPG, PNG, and WebP are supported. ${planFileSizeFaqLine()}`,
  },
  {
    q: "Which filter should I use?",
    a: "Original applies no enhancement. Black & White creates a two-tone image and can lose faint text or shading. Enhanced normalizes contrast and sharpens the image; results depend on the source. The preview is approximate, so check the downloaded PDF for readability.",
  },
  {
    q: "How should I prepare my images?",
    a: "Photograph each page straight on with the full document in frame. Crop or straighten images before uploading. The scanner uses the framing you provide, so check that no text is cut off.",
  },
  {
    q: "What page size does the scanner use?",
    a: "Each image is fitted inside an A4 portrait page with 20-point margins. Review every page of the downloaded PDF to check its framing, order, and readability.",
  },
  {
    q: "Will the PDF text be searchable or editable?",
    a: "The scanner creates an image-based PDF without OCR or a searchable text layer. Use OCR separately if you need recognized text for searching, copying, or editing.",
  },
  {
    q: "Does the camera work on desktop?",
    a: "Camera capture requires a camera, browser support, and permission to use it. You can also upload JPG, PNG, or WebP images from your device.",
  },
  {
    q: "How are files handled?",
    a: "Files are uploaded for processing over HTTPS/TLS. Under the published retention policy, files are scheduled for deletion within 2 hours for Free users or 24 hours for Pro users.",
  },
];

export default function PDFScannerPage() {
  return (
    <ToolPageShell
      title="PDF Scanner"
      description={`Capture or upload up to ${SCANNER_MAX_IMAGES} JPG, PNG, or WebP images, choose a filter, and save them as one image-based PDF.`}
      fullWidthWorkspace
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      faqs={mapFaqs(FAQS)}
    >
      <PdfScannerWorkspace />
      <p className="mt-4 text-sm leading-relaxed text-pd-muted">
        See what was checked in our{" "}
        <Link href="/benchmarks#scanner-results" className="inline-flex min-h-11 items-center font-semibold text-pd-brand underline underline-offset-4">
          PDF Scanner test results and limitations
        </Link>.
      </p>
    </ToolPageShell>
  );
}
