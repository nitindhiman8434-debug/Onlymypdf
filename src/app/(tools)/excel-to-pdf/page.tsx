"use client";

import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function ExcelToPdfPage() {
  return (
    <ConvertToolPage
      title="Excel to PDF"
      description="Convert Excel spreadsheets to PDF documents"
      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      uploadHint="Select an Excel file (.xls or .xlsx)"
      processLabel="Convert to PDF"
      processingLabel="Converting to PDF..."
      successTitle="PDF ready!"
      successDescription="Your Excel workbook has been converted to PDF."
      downloadLabel="Download PDF"
      outputExtension="pdf"
      apiPath="/api/tools/excel-to-pdf"
      fetchTimeoutMs={180_000}
      progressCap={97}
      relatedTools={[
        { name: "PDF to Excel", href: "/pdf-to-excel" },
        { name: "Word to PDF", href: "/word-to-pdf" },
        { name: "Compress PDF", href: "/compress-pdf" },
        { name: "Merge PDF", href: "/merge-pdf" },
      ]}
    />
  );
}
