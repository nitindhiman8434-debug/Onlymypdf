"use client";

import { useState } from "react";
import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function PdfAPage() {
  const [level, setLevel] = useState("2b");
  return (
    <ConvertToolPage
      title="Convert to PDF/A"
      description="Create an archival PDF/A copy with embedded fonts and an sRGB output profile"
      accept=".pdf,application/pdf"
      uploadHint="PDF only. Validate the result against your archive's required profile before submission."
      processLabel="Convert to PDF/A"
      processingLabel="Creating archival PDF..."
      successTitle="PDF/A file ready"
      successDescription="The archival copy was generated with the selected conformance target."
      downloadLabel="Download PDF/A"
      outputExtension="pdf"
      apiPath="/api/tools/pdf-a"
      supportsPdfPassword
      fetchTimeoutMs={900_000}
      buildResultFilename={(name) => name.replace(/\.pdf$/i, "-pdfa.pdf")}
      extraFields={
        <div>
          <label htmlFor="pdfa-level" className="mb-1.5 block text-sm font-semibold text-pd-foreground">
            Archival profile
          </label>
          <select
            id="pdfa-level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="w-full rounded-xl border border-pd-border bg-pd-surface px-3 py-2.5 text-sm text-pd-foreground focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20"
          >
            <option value="2b">PDF/A-2b — recommended</option>
            <option value="1b">PDF/A-1b — older archives</option>
            <option value="3b">PDF/A-3b — allows attachments</option>
          </select>
        </div>
      }
      buildFormData={(_file, formData) => {
        formData.set("level", level);
        return formData;
      }}
      relatedTools={[
        { name: "Repair PDF", href: "/repair-pdf" },
        { name: "OCR PDF", href: "/ocr-pdf" },
        { name: "Compress PDF", href: "/compress-pdf" },
        { name: "Protect PDF", href: "/protect-pdf" },
      ]}
    />
  );
}
