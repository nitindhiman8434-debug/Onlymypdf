"use client";

import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function PdfToPptPage() {
  return (
    <ConvertToolPage
      title="PDF to PowerPoint"
      description="Convert PDF pages into PowerPoint slides with editable text from selectable PDF text"
      accept=".pdf,application/pdf"
      uploadHint="Select a PDF file — selectable horizontal text becomes editable on slides"
      processLabel="Convert to PowerPoint"
      processingLabel="Converting to PowerPoint..."
      successTitle="PowerPoint file ready!"
      successDescription="Your slides are ready. Selectable horizontal PDF text can be edited directly on slides; scans and graphics remain visual."
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
