"use client";

import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function PdfToExcelPage() {
  return (
    <ConvertToolPage
      title="PDF to Excel"
      description="Convert PDF tables and text into an editable Excel spreadsheet"
      accept=".pdf,application/pdf"
      uploadHint="Select a PDF file to convert to Excel (.xlsx)"
      processLabel="Convert to Excel"
      processingLabel="Converting to Excel..."
      successTitle="Excel file ready!"
      successDescription="Your spreadsheet is ready. If table mapping missed text, review the Source text worksheet."
      downloadLabel="Download XLSX"
      outputExtension="xlsx"
      apiPath="/api/tools/pdf-to-excel"
      supportsPdfPassword
      fetchTimeoutMs={3_600_000}
      progressCap={96}
      relatedTools={[
        { name: "Excel to PDF", href: "/excel-to-pdf" },
        { name: "PDF to Word", href: "/pdf-to-word" },
        { name: "PDF to PPT", href: "/pdf-to-ppt" },
        { name: "Compress PDF", href: "/compress-pdf" },
      ]}
    />
  );
}
