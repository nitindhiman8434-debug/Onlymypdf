"use client";

import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function PdfToPptPage() {
  return (
    <ConvertToolPage
      title="PDF to PowerPoint"
      description="Convert PDF pages into slides; simple text stays on-slide editable, dense pages keep an editable notes transcript"
      accept=".pdf,application/pdf"
      uploadHint="Select a PDF file — dense pages may keep a visual slide with editable speaker notes"
      processLabel="Convert to PowerPoint"
      processingLabel="Converting to PowerPoint..."
      successTitle="PowerPoint file ready!"
      successDescription="Your slides are ready. Simple text is editable on-slide; dense pages keep their visual layout with editable text in speaker notes."
      downloadLabel="Download PPTX"
      outputExtension="pptx"
      apiPath="/api/tools/pdf-to-ppt"
      supportsPdfPassword
      progressCap={88}
      progressIntervalMs={480}
      progressStallCap={97}
      progressStallIntervalMs={2200}
      fetchTimeoutMs={900_000}
      relatedTools={[
        { name: "PowerPoint to PDF", href: "/ppt-to-pdf" },
        { name: "PDF to Word", href: "/pdf-to-word" },
        { name: "PDF to Excel", href: "/pdf-to-excel" },
        { name: "Compress PDF", href: "/compress-pdf" },
      ]}
    />
  );
}
