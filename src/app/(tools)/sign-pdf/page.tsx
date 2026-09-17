'use client';

import { planFileSizeFaqLine } from '@/lib/billing/billing-copy';
import { useCallback, useRef, useState } from 'react';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { SignPdfWorkspace } from '@/components/tools/lazy-workspaces';
import { PdfResultPreview } from '@/components/tools/pdf-result-preview';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import { ToolDropzone, ToolErrorBanner, PdfPasswordInfoBanner } from '@/components/tools/tool-ui';

const RELATED_TOOLS = [
  { name: 'Protect PDF', href: '/protect-pdf' },
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Compress PDF', href: '/compress-pdf' },
  { name: 'Unlock PDF', href: '/unlock-pdf' },
];

const FAQS = [
  {
    q: 'Is my signature secure?',
    a: 'Your signature is composited into the result on our server. The uploaded and processed files follow the published retention window.',
  },
  {
    q: 'What types of signatures can I add?',
    a: 'Draw a signature, type your name in a signature style, upload an image, add initials, dates, text, and checkmarks — all placed directly on the document.',
  },
  {
    q: 'Can I sign multiple pages?',
    a: 'Yes. Use the page thumbnails to navigate, then place signatures and annotations on any page before exporting.',
  },
  {
    q: 'Is there a file size limit?',
    a: planFileSizeFaqLine(),
  },
];

export default function SignPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const pdf = Array.from(incoming).find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdf) {
      setFile(pdf);
      setUploadError(null);
      setCompleted(false);
      setResultUrl(null);
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
    setCompleted(false);
    setResultUrl(null);
    setResultFilename(null);
    setResultSize(undefined);
  };

  return (
    <ToolPageShell
      title="Sign PDF"
      description="Add signatures, initials, dates, and annotations in a visual editor"
      fullWidthWorkspace={!!file}
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      faqs={mapFaqs(FAQS)}
    >
      {completed && resultUrl ? (
        <PdfResultPreview
          blobUrl={resultUrl}
          filename={resultFilename ?? 'signed.pdf'}
          fileSize={resultSize}
          onReset={reset}
          resetLabel="Sign another document"
        />
      ) : file ? (
        <SignPdfWorkspace
          file={file}
          onReset={reset}
          onComplete={({ url, filename, size }) => {
            setResultUrl(url);
            setResultFilename(filename);
            setResultSize(size);
            setCompleted(true);
          }}
        />
      ) : (
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
          {uploadError && (
            <div className="mt-4">
              <ToolErrorBanner message={uploadError} />
            </div>
          )}
        </div>
      )}
    </ToolPageShell>
  );
}
