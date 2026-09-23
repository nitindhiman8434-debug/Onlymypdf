"use client";

import { useRef, useState } from "react";
import { FileSearch, FileText, X } from "lucide-react";
import { ConvertToolPage } from "@/components/tools/convert-tool-page";
import { formatFileSize } from "@/lib/utils/file";

export default function ComparePdfPage() {
  const [compareFile, setCompareFile] = useState<File | null>(null);
  const compareInputRef = useRef<HTMLInputElement>(null);

  return (
    <ConvertToolPage
      title="Compare PDF"
      description="Compare two PDFs page by page and download a visual difference report."
      icon={<FileSearch className="h-8 w-8" />}
      accept="application/pdf,.pdf"
      uploadHint="PDF only · first document · up to your plan limit"
      processLabel="Compare PDFs"
      processingLabel="Comparing pages..."
      successTitle="Comparison report ready"
      successDescription="Review the side-by-side pages and highlighted visual differences."
      downloadLabel="Download comparison report"
      outputExtension="pdf"
      apiPath="/api/tools/compare-pdf"
      supportsPdfPassword
      fetchTimeoutMs={600_000}
      processDisabled={!compareFile}
      buildResultFilename={(name) => name.replace(/\.pdf$/i, "-comparison.pdf")}
      extraFields={
        <div>
          <label htmlFor="compare-pdf-second-file" className="mb-1.5 block text-sm font-semibold text-pd-foreground">
            Second PDF
          </label>
          <input
            ref={compareInputRef}
            id="compare-pdf-second-file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => setCompareFile(event.target.files?.[0] ?? null)}
          />
          {compareFile ? (
            <div className="flex items-center gap-3 rounded-xl border border-pd-border bg-pd-surface p-3">
              <FileText className="h-5 w-5 shrink-0 text-pd-brand" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pd-foreground">{compareFile.name}</p>
                <p className="text-xs text-pd-muted">{formatFileSize(compareFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompareFile(null);
                  if (compareInputRef.current) compareInputRef.current.value = "";
                }}
                className="rounded-lg p-2 text-pd-muted hover:bg-pd-brand-muted hover:text-pd-foreground focus:outline-none focus:ring-2 focus:ring-pd-brand"
                aria-label="Remove second PDF"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => compareInputRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-pd-border bg-pd-surface px-4 py-4 text-sm font-semibold text-pd-brand transition-colors hover:border-pd-brand hover:bg-pd-brand-muted focus:outline-none focus:ring-2 focus:ring-pd-brand"
            >
              Choose second PDF
            </button>
          )}
          <p className="mt-1 text-xs text-pd-muted">
            Visual comparison supports up to 50 pages and 25 MB per PDF. It highlights rendered page differences; it is not a legal document-authenticity check.
          </p>
        </div>
      }
      buildFormData={(_file, formData) => {
        if (compareFile) formData.set("compareFile", compareFile);
        return formData;
      }}
      relatedTools={[
        { name: "OCR PDF", href: "/ocr-pdf" },
        { name: "Repair PDF", href: "/repair-pdf" },
        { name: "Redact PDF", href: "/redact-pdf" },
        { name: "Crop PDF", href: "/crop-pdf" },
      ]}
    />
  );
}
