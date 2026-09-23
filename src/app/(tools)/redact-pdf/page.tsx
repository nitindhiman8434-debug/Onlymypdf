"use client";

import { useState } from "react";
import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function RedactPdfPage() {
  const [terms, setTerms] = useState("");
  return (
    <ConvertToolPage
      title="Redact PDF"
      description="Permanently remove every occurrence of selected text from a searchable PDF"
      accept=".pdf,application/pdf"
      uploadHint="Searchable PDF only. Run OCR first for scanned pages."
      processLabel="Apply Redactions"
      processingLabel="Removing matching text..."
      successTitle="Redacted PDF ready"
      successDescription="Matching text was removed from the PDF content and covered in black. Review every page before sharing."
      downloadLabel="Download Redacted PDF"
      outputExtension="pdf"
      apiPath="/api/tools/redact-pdf"
      supportsPdfPassword
      fetchTimeoutMs={600_000}
      processDisabled={!terms.trim()}
      buildResultFilename={(name) => name.replace(/\.pdf$/i, "-redacted.pdf")}
      extraFields={
        <div>
          <label htmlFor="redaction-terms" className="mb-1.5 block text-sm font-semibold text-pd-foreground">
            Text to remove
          </label>
          <textarea
            id="redaction-terms"
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            rows={4}
            maxLength={2400}
            placeholder="Enter one word or phrase per line"
            className="w-full resize-y rounded-xl border border-pd-border bg-pd-surface px-3 py-2.5 text-sm text-pd-foreground placeholder:text-pd-muted focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20"
          />
          <p className="mt-1 text-xs text-pd-muted">Up to 20 exact text terms. This removes text content; it is safer than drawing a visual box.</p>
        </div>
      }
      buildFormData={(_file, formData) => {
        formData.set("terms", terms);
        return formData;
      }}
      relatedTools={[
        { name: "OCR PDF", href: "/ocr-pdf" },
        { name: "Edit PDF", href: "/edit-pdf" },
        { name: "Crop PDF", href: "/crop-pdf" },
        { name: "Protect PDF", href: "/protect-pdf" },
      ]}
    />
  );
}
