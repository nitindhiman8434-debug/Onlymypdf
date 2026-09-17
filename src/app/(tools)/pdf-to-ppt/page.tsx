"use client";

import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function PdfToPptPage() {
  return (
    <ConvertToolPage
      title="PDF to PowerPoint"
      description="Convert PDF pages into PowerPoint slides — edit full page text in Notes or Selection Pane"
      accept=".pdf,application/pdf"
      uploadHint="Select a PDF file — slides keep the original look; page text is editable in Notes"
      processLabel="Convert to PowerPoint"
      processingLabel="Converting to PowerPoint..."
      successTitle="PowerPoint file ready!"
      successDescription="Slides match your PDF. Edit page text via View → Notes, or Home → Selection Pane → Page text."
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
