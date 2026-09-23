"use client";

import { useState } from "react";
import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function OcrPdfPage() {
  const [languages, setLanguages] = useState("eng+hin");
  return (
    <ConvertToolPage
      title="OCR PDF"
      description="Add a searchable text layer to readable printed English and Hindi scans"
      accept=".pdf,application/pdf"
      uploadHint="PDF only · Up to 50 pages · Printed text; handwriting is not supported"
      processLabel="Make PDF Searchable"
      processingLabel="Recognizing text..."
      successTitle="Searchable PDF ready"
      successDescription="Recognized pages now include a searchable text layer. Review important text for OCR errors."
      downloadLabel="Download Searchable PDF"
      outputExtension="pdf"
      apiPath="/api/tools/ocr-pdf"
      supportsPdfPassword
      fetchTimeoutMs={900_000}
      buildResultFilename={(name) => name.replace(/\.pdf$/i, "-searchable.pdf")}
      extraFields={
        <div>
          <label htmlFor="ocr-languages" className="mb-1.5 block text-sm font-semibold text-pd-foreground">
            Document language
          </label>
          <select
            id="ocr-languages"
            value={languages}
            onChange={(event) => setLanguages(event.target.value)}
            className="w-full rounded-xl border border-pd-border bg-pd-surface px-3 py-2.5 text-sm text-pd-foreground focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20"
          >
            <option value="eng+hin">English + Hindi</option>
            <option value="eng">English</option>
            <option value="hin">Hindi</option>
          </select>
        </div>
      }
      buildFormData={(_file, formData) => {
        formData.set("languages", languages);
        return formData;
      }}
      relatedTools={[
        { name: "PDF to Word", href: "/pdf-to-word" },
        { name: "PDF Scanner", href: "/pdf-scanner" },
        { name: "Redact PDF", href: "/redact-pdf" },
        { name: "Repair PDF", href: "/repair-pdf" },
      ]}
    />
  );
}
