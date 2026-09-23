"use client";

import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function RepairPdfPage() {
  return (
    <ConvertToolPage
      title="Repair PDF"
      description="Rebuild recoverable PDF structure and create a clean, openable copy"
      accept=".pdf,application/pdf"
      uploadHint="PDF only. Severely corrupted or incomplete files may not be recoverable."
      processLabel="Repair PDF"
      processingLabel="Repairing PDF..."
      successTitle="Repaired PDF ready"
      successDescription="A clean copy was created from the recoverable pages and objects."
      downloadLabel="Download Repaired PDF"
      outputExtension="pdf"
      apiPath="/api/tools/repair-pdf"
      supportsPdfPassword
      fetchTimeoutMs={300_000}
      buildResultFilename={(name) => name.replace(/\.pdf$/i, "-repaired.pdf")}
      relatedTools={[
        { name: "Compress PDF", href: "/compress-pdf" },
        { name: "Unlock PDF", href: "/unlock-pdf" },
        { name: "OCR PDF", href: "/ocr-pdf" },
        { name: "PDF/A", href: "/pdf-a" },
      ]}
    />
  );
}
