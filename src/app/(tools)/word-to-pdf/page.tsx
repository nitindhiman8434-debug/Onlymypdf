'use client';

import { useState, useRef, useCallback } from 'react';
import { planFileSizeFaqLine } from '@/lib/billing/billing-copy';
import { FileText } from 'lucide-react';
import { formatFileSize } from '@/lib/utils/file';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import {
  ToolDropzone,
  ToolErrorBanner,
  ToolPrimaryButton,
} from '@/components/tools/tool-ui';
import { PdfResultPreview } from '@/components/tools/pdf-result-preview';
import { useToolErrors } from '@/hooks/use-tool-errors';

const RELATED_TOOLS = [
  { name: 'PDF to Word', href: '/pdf-to-word' },
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Compress PDF', href: '/compress-pdf' },
  { name: 'JPG to PDF', href: '/jpg-to-pdf' },
];

const FAQS = [
  { q: 'What Word formats are supported?', a: 'We support both .doc and .docx formats. For best results, use the newer .docx format.' },
  { q: 'Will the formatting be preserved?', a: 'Common fonts, images, tables, and styles are retained when supported. Complex layouts or unavailable fonts can vary, so preview the result before use.' },
  { q: 'Is there a file size limit?', a: planFileSizeFaqLine() },
  { q: 'Can I convert multiple files at once?', a: 'Currently, conversion works one file at a time. You can use our Merge tool to combine the resulting PDFs.' },
];

export default function WordToPdfPage() {
  const { resolveApiError, resolveCatchError } = useToolErrors();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | undefined>();
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [previewTotalPages, setPreviewTotalPages] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter(
      f => f.name.endsWith('.doc') || f.name.endsWith('.docx') ||
        f.type === 'application/msword' ||
        f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    if (accepted.length > 0) {
      setFiles([accepted[0]]);
      setError(null);
      setCompleted(false);
      setResultUrl(null);
      setPreviewSessionId(null);
      setPreviewTotalPages(0);
      setProgress(0);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleProcess = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setProgress(20);

    const progressTimer = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + 1 : p));
    }, 1500);

    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), 58_000);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      setProgress(50);
      const res = await fetch('/api/tools/word-to-pdf', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(resolveApiError(err, 'errors.processingFailed'));
      }

      setProgress(92);
      const blob = await res.blob();
      if (!blob.size) {
        throw new Error(resolveApiError('Conversion returned an empty file.', 'errors.processingFailed'));
      }
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultSize(blob.size);
      setPreviewSessionId(res.headers.get("X-Pdf-Session-Id"));
      setPreviewTotalPages(
        parseInt(res.headers.get("X-Pdf-Total-Pages") ?? "0", 10) || 0
      );
      setResultFilename(files[0].name.replace(/\.docx?$/, '.pdf'));
      setProgress(100);
      setCompleted(true);
      const { notifyActivityUpdated } = await import("@/lib/client/activity-events");
      notifyActivityUpdated();
    } catch (err) {
      setError(
        resolveCatchError(err, { timeoutKey: 'toolPage.errors.wordConversionTimeout' })
      );
      setProgress(0);
    } finally {
      window.clearInterval(progressTimer);
      window.clearTimeout(abortTimer);
      setProcessing(false);
    }
  };

  const handleReset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setCompleted(false);
    setFiles([]);
    setResultUrl(null);
    setResultSize(undefined);
    setPreviewSessionId(null);
    setPreviewTotalPages(0);
    setProgress(0);
  };

  return (
    <ToolPageShell
      title="Word to PDF"
      description="Convert Word documents to PDF format"
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      faqs={mapFaqs(FAQS)}
      fullWidthWorkspace={completed}
    >
      {completed && resultUrl ? (
        <PdfResultPreview
          blobUrl={resultUrl}
          filename={resultFilename || 'converted.pdf'}
          fileSize={resultSize}
          initialSessionId={previewSessionId}
          initialTotalPages={previewTotalPages}
          onReset={handleReset}
          resetLabel="Convert another file"
        />
      ) : (
        <>
          <ToolDropzone
            hint="Drop a Word document here or click to browse"
            formatNote="Supports .doc and .docx files"
            dragOver={dragOver}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onChooseFiles={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            fileInputAccept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onFileInputChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          

          {files.length > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-pd-brand-muted p-3">
              <FileText className="h-4 w-4 shrink-0 text-pd-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pd-foreground">{files[0].name}</p>
                <p className="text-xs text-pd-muted">{formatFileSize(files[0].size)}</p>
              </div>
            </div>
          )}

          {processing && (
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-pd-border">
                <div
                  className="h-2 rounded-full bg-pd-brand transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-pd-muted">{progress}% complete</p>
            </div>
          )}

          {error && <ToolErrorBanner message={error} />}

          <ToolPrimaryButton
            onClick={handleProcess}
            disabled={files.length === 0}
            loading={processing}
            loadingLabel="Converting to PDF..."
          >
            Convert to PDF
          </ToolPrimaryButton>
        </>
      )}
    </ToolPageShell>
  );
}
