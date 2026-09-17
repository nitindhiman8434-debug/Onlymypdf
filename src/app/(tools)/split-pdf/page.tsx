'use client';

import { useState, useRef, useCallback } from 'react';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import { SplitPdfWorkspace } from '@/components/tools/split-pdf/split-pdf-workspace';
import { ToolDropzone, ToolErrorBanner, ToolHiddenFileInput, PdfPasswordInfoBanner } from '@/components/tools/tool-ui';

const RELATED_TOOLS = [
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Compress PDF', href: '/compress-pdf' },
  { name: 'PDF to Word', href: '/pdf-to-word' },
  { name: 'Word to PDF', href: '/word-to-pdf' },
];

const FAQS = [
  { q: 'Can I extract specific pages from a PDF?', a: 'Yes! Switch to Extract, select pages in the grid, then click Finish.' },
  { q: 'What happens when I split all pages?', a: 'Each page becomes a separate PDF, bundled in a ZIP download.' },
  { q: 'Is the original PDF quality preserved?', a: 'Absolutely. Splitting does not alter the content or quality of your pages.' },
  { q: 'Can I split a password-protected PDF?', a: 'Yes. When you export, we will ask for the PDF password if the file is locked.' },
];

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length > 0) {
      setFile(pdfFiles[0]);
      setUploadId((id) => id + 1);
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
      title="Split PDF"
      description="Split or extract pages visually — like a professional PDF workspace"
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
            After upload you&apos;ll see a page grid with split points — inspired by modern PDF editors.
          </p>
        </div>
      ) : (
        <div className="w-full">
          <SplitPdfWorkspace
            key={`${file.name}:${file.size}:${file.lastModified}:${uploadId}`}
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
