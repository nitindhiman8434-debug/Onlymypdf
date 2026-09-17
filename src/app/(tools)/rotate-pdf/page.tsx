'use client';

import { useState, useRef, useCallback } from 'react';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import { RotatePdfWorkspace } from '@/components/tools/lazy-workspaces';
import { ToolDropzone, ToolErrorBanner, ToolHiddenFileInput, PdfPasswordInfoBanner } from '@/components/tools/tool-ui';

const RELATED_TOOLS = [
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Split PDF', href: '/split-pdf' },
  { name: 'Compress PDF', href: '/compress-pdf' },
  { name: 'PDF to Word', href: '/pdf-to-word' },
];

const FAQS = [
  { q: 'Can I rotate individual pages?', a: 'Yes! Hover over any page and click the rotate button, or select multiple pages and rotate them all at once.' },
  { q: 'Can I add pages from another PDF?', a: 'Yes! Click the + button between any two pages to add documents or blank pages.' },
  { q: 'Is the original quality preserved?', a: 'Absolutely. Rotation changes metadata only — your content and quality stay identical.' },
  { q: 'What rotation angles are supported?', a: '90° clockwise, 90° counter-clockwise, and 180° flip. You can combine rotations.' },
];

export default function RotatePdfPage() {
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
      title="Rotate PDF"
      description="Rotate PDF pages visually — click, select, and export"
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
            After upload you&apos;ll see all pages in a visual grid — rotate, add, and reorder.
          </p>
        </div>
      ) : (
        <div className="w-full">
          <RotatePdfWorkspace
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
