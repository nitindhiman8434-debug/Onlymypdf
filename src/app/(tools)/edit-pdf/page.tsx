'use client';

import { useCallback, useRef, useState } from 'react';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { EditPdfWorkspace } from '@/components/tools/lazy-workspaces';
import { mapRelatedTools } from '@/components/tools/tool-helpers';
import { ToolDropzone, ToolErrorBanner, PdfPasswordInfoBanner } from '@/components/tools/tool-ui';
import { TOOLS } from '@/config/constants';
import { planFileSizeFaqLine } from '@/lib/billing/billing-copy';
import type { FAQ } from '@/types';

const FAQS: FAQ[] = [
  {
    question: 'What types of edits can I make to a PDF?',
    answer:
      'Add text anywhere on any page, insert images, drag to reposition, and export — all in a visual editor like professional PDF tools.',
  },
  {
    question: 'Will editing affect the original PDF quality?',
    answer:
      'No. Additions are layered on top of your existing content without re-compressing the underlying document.',
  },
  {
    question: 'Is there a page or file size limit?',
    answer:
      `There is no page limit for editing. ${planFileSizeFaqLine()}`,
  },
];

const relatedTools = TOOLS.filter((t) => t.slug !== 'edit-pdf').slice(0, 4);

export default function EditPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const pdf = Array.from(incoming).find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdf) {
      setFile(pdf);
      setUploadError(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const reset = () => {
    setFile(null);
    setUploadError(null);
  };

  return (
    <ToolPageShell
      title="Edit PDF"
      description="Edit text, draw, highlight, add shapes, images & signatures in a full-screen workspace"
      fullWidthWorkspace
      relatedTools={mapRelatedTools(relatedTools.map((t) => ({ name: t.name, href: `/${t.slug}` })))}
      faqs={FAQS}
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
            fileInputAccept=".pdf,application/pdf"
            onFileInputChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <PdfPasswordInfoBanner className="mt-3" />
          {uploadError && <ToolErrorBanner message={uploadError} />}
          <p className="mt-4 text-center text-xs text-pd-muted">
            After upload you&apos;ll enter a full-screen editor with page thumbnails, toolbar, and
            click-to-place editing.
          </p>
        </div>
      ) : (
        <EditPdfWorkspace
          file={file}
          onChangeFile={reset}
          onReset={reset}
        />
      )}
    </ToolPageShell>
  );
}
