'use client';

import { planFileSizeFaqLine } from '@/lib/billing/billing-copy';
import { useState, useRef, useCallback } from 'react';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import { DeletePdfWorkspace } from '@/components/tools/lazy-workspaces';
import { ToolDropzone, ToolErrorBanner, ToolHiddenFileInput, PdfPasswordInfoBanner } from '@/components/tools/tool-ui';

const RELATED_TOOLS = [
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Split PDF', href: '/split-pdf' },
  { name: 'Rotate PDF', href: '/rotate-pdf' },
  { name: 'Compress PDF', href: '/compress-pdf' },
];

const FAQS = [
  { q: 'Can I delete individual pages?', a: 'Yes! Hover over any page and click the red trash icon, or select multiple pages and delete them all at once.' },
  { q: 'Can I add pages from another PDF?', a: 'Yes! Click the + button between any two pages to add documents or blank pages.' },
  { q: 'Is the original quality preserved?', a: 'Absolutely. Only the selected pages are removed — all remaining content and quality stay identical.' },
  { q: 'Is there a file size limit?', a: planFileSizeFaqLine() },
];

export default function DeletePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length > 0) {
      setFile(pdfFiles[0]);
      setUploadError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <ToolPageShell
      title="Delete PDF Pages"
      description="Remove pages from your PDF — select, delete, and export"
      fullWidthWorkspace
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      faqs={mapFaqs(FAQS)}
    >
      {!file ? (
        <div className="mx-auto max-w-xl">
          <ToolDropzone
            chooseLabel="Select PDF"
            hint="or drag and drop your PDF here"
            formatNote="PDF only"
            dragOver={dragOver}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onChooseFiles={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            fileInputAccept=".pdf"
            onFileInputChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <PdfPasswordInfoBanner className="mt-3" />
          {uploadError && <ToolErrorBanner message={uploadError} />}
          <p className="mt-4 text-center text-xs text-pd-muted">
            After upload you&apos;ll see all pages in a visual grid — click the trash icon to remove pages.
          </p>
        </div>
      ) : (
        <div className="w-full">
          <DeletePdfWorkspace
            file={file}
            onChangeFile={() => fileInputRef.current?.click()}
            onReset={() => setFile(null)}
          />
          <ToolHiddenFileInput
            ref={fileInputRef}
            accept=".pdf"
            ariaLabel="Change PDF file"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFiles(e.target.files);
            }}
          />
        </div>
      )}
    </ToolPageShell>
  );
}
