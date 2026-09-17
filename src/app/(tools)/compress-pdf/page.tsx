'use client';

import { planFileSizeFaqLine } from '@/lib/billing/billing-copy';
import { useState, useRef, useCallback } from 'react';
import { Minimize2, Zap, Shield } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatFileSize } from '@/lib/utils/file';
import { getMaxFileSizeMB } from '@/config/constants';
import { useAuth } from '@/hooks/use-auth';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import { CompressionLevelPreview } from '@/components/tools/previews/compression-preview';
import { PdfPasswordModal } from '@/components/tools/pdf-password-modal';
import {
  ToolDropzone,
  ToolErrorBanner,
  ToolHiddenFileInput,
  ToolPrimaryButton,
  ToolSuccessPanel,
  PdfPasswordInfoBanner,
} from '@/components/tools/tool-ui';
import { postToolFormDataWithProgress } from '@/lib/client/tool-form-upload';
import { passwordPromptFromError } from '@/lib/client/pdf-password-errors';
import { useToolWorkspaceMessages } from '@/hooks/use-tool-workspace-messages';
import { useToolErrors } from '@/hooks/use-tool-errors';

const RELATED_TOOLS = [
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Split PDF', href: '/split-pdf' },
  { name: 'PDF to Word', href: '/pdf-to-word' },
  { name: 'JPG to PDF', href: '/jpg-to-pdf' },
];

const FAQS = [
  { q: 'How much can a PDF be compressed?', a: 'Compression results vary depending on the content. Files with images typically see 40-80% reduction, while text-heavy PDFs may see 10-30% reduction.' },
  { q: 'Will compression reduce the quality of my PDF?', a: 'Basic compression preserves quality while reducing size. Strong compression may slightly reduce image quality but keeps text crisp.' },
  { q: 'Is there a file size limit?', a: planFileSizeFaqLine() },
  { q: 'Can I compress multiple files at once?', a: 'Currently, compression works on one file at a time. Use our Merge tool to combine files after compressing them individually.' },
];

type CompressionLevel = 'basic' | 'strong';

export default function CompressPdfPage() {
  const ws = useToolWorkspaceMessages();
  const { fileSizeError, resolveCatchError } = useToolErrors();
  const { isPro } = useAuth();
  const maxSizeMB = getMaxFileSizeMB(isPro);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('basic');
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [compressionStatus, setCompressionStatus] = useState<"compressed" | "already-optimized">("compressed");
  const [compressionMethod, setCompressionMethod] = useState<"structural" | "rasterized" | "original">("original");
  const [pdfPassword, setPdfPassword] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    errorMsg?: string;
    loading?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length > 0) {
      const file = pdfFiles[0];
      setFiles([file]);
      setOriginalSize(file.size);
      setCompleted(false);
      setResultUrl(null);
      setPdfPassword(null);
      setPasswordPrompt(null);

      const sizeMsg = fileSizeError(file, maxSizeMB);
      setError(sizeMsg);
    }
  }, [maxSizeMB, fileSizeError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const runCompress = useCallback(async (password?: string | null) => {
    if (files.length === 0) return;

    const sizeMsg = fileSizeError(files[0], maxSizeMB);
    if (sizeMsg) {
      setError(sizeMsg);
      return;
    }

    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('level', compressionLevel);
      const pw = password ?? pdfPassword;
      if (pw) formData.append('password', pw);

      const { blob, getHeader } = await postToolFormDataWithProgress(
        '/api/tools/compress-pdf',
        formData,
        setProgress
      );

      setResultUrl(URL.createObjectURL(blob));
      setResultFilename('compressed.pdf');
      const headerOriginal = getHeader('X-Original-Size');
      const headerCompressed = getHeader('X-Compressed-Size');
      const headerStatus = getHeader('X-Compression-Status');
      const headerMethod = getHeader('X-Compression-Method');
      setCompressedSize(headerCompressed ? parseInt(headerCompressed, 10) : blob.size);
      setCompressionStatus(headerStatus === 'already-optimized' ? 'already-optimized' : 'compressed');
      setCompressionMethod(
        headerMethod === 'rasterized' || headerMethod === 'structural'
          ? headerMethod
          : 'original'
      );
      if (headerOriginal) setOriginalSize(parseInt(headerOriginal, 10));
      if (pw) setPdfPassword(pw);
      setPasswordPrompt(null);
      setCompleted(true);
      const { notifyActivityUpdated } = await import("@/lib/client/activity-events");
      notifyActivityUpdated();
    } catch (err) {
      const prompt = passwordPromptFromError(err, files[0].name);
      if (prompt) {
        setPasswordPrompt(prompt);
        return;
      }
      setError(resolveCatchError(err));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [files, compressionLevel, pdfPassword, maxSizeMB, fileSizeError, resolveCatchError]);

  const handleProcess = () => runCompress();

  const compressionPercentage = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

  return (
    <ToolPageShell
      title="Compress PDF"
      description="Choose lossless Basic optimization or smaller Strong compression"
      splitWorkspace={!completed}
      previewPlaceholder="Select a PDF to see estimated compression"
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      faqs={mapFaqs(FAQS)}
      preview={
        files.length > 0 && !completed ? (
          <CompressionLevelPreview level={compressionLevel} originalSize={originalSize} />
        ) : undefined
      }
    >
      {completed && resultUrl ? (
        <ToolSuccessPanel
          title={ws.compressSuccess}
          downloadUrl={resultUrl}
          downloadFilename={resultFilename || 'compressed.pdf'}
          downloadLabel={ws.downloadCompressedPdf}
          originalSizeBytes={originalSize}
          resultSizeBytes={compressedSize}
          savedPercent={compressionPercentage > 0 ? compressionPercentage : undefined}
          resetLabel={ws.compressAnother}
          onReset={() => {
            setCompleted(false);
            setFiles([]);
            setResultUrl(null);
            setCompressedSize(0);
            setCompressionStatus('compressed');
            setCompressionMethod('original');
          }}
        >
          {compressionStatus === 'already-optimized' ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {ws.alreadyOptimized}
            </p>
          ) : null}
          {compressionMethod === 'rasterized' ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {ws.rasterizedResultWarning}
            </p>
          ) : null}
        </ToolSuccessPanel>
      ) : (
        <>
          {passwordPrompt && (
            <PdfPasswordModal
              fileName={passwordPrompt.fileName}
              errorMessage={passwordPrompt.errorMsg}
              loading={passwordPrompt.loading}
              onSubmit={(pw) => {
                setPasswordPrompt((prev) => prev ? { ...prev, loading: true, errorMsg: undefined } : prev);
                void runCompress(pw);
              }}
              onCancel={() => {
                setPasswordPrompt(null);
                setFiles([]);
                setPdfPassword(null);
              }}
            />
          )}

          <PdfPasswordInfoBanner className="mt-3" />

          {files.length === 0 ? (
            <ToolDropzone
              chooseLabel={ws.selectPdf}
              hint={ws.dragDropPdf}
              formatNote={ws.pdfOnlyShort}
              dragOver={dragOver}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onChooseFiles={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            fileInputAccept=".pdf"
            onFileInputChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          ) : (
            <>
              <ToolHiddenFileInput
                ref={fileInputRef}
                accept=".pdf,application/pdf"
                ariaLabel={ws.chooseDifferentPdf}
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              <div className="flex items-center gap-2 rounded-lg border border-pd-border bg-pd-brand-muted px-3 py-2">
                <Minimize2 className="h-4 w-4 shrink-0 text-pd-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-pd-foreground">{files[0].name}</p>
                  <p className="text-xs text-pd-muted">{formatFileSize(files[0].size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 text-xs font-medium text-pd-brand hover:underline"
                >
                  {ws.change}
                </button>
              </div>

              <div className="mt-3">
                <p id="compression-level-label" className="mb-1.5 text-xs font-semibold text-pd-foreground">{ws.compressionLevel}</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="compression-level-label">
                  <button
                    type="button"
                    onClick={() => setCompressionLevel('basic')}
                    aria-pressed={compressionLevel === 'basic'}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                      compressionLevel === 'basic'
                        ? 'border-pd-brand bg-pd-brand-muted text-pd-foreground'
                        : 'border-pd-border text-pd-muted hover:border-pd-brand/40'
                    )}
                  >
                    <Shield className="h-3.5 w-3.5 text-pd-brand" />
                    {ws.compressionBasic}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompressionLevel('strong')}
                    aria-pressed={compressionLevel === 'strong'}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                      compressionLevel === 'strong'
                        ? 'border-pd-brand bg-pd-brand-muted text-pd-foreground'
                        : 'border-pd-border text-pd-muted hover:border-pd-brand/40'
                    )}
                  >
                    <Zap className="h-3.5 w-3.5 text-pd-brand" />
                    {ws.compressionStrong}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-pd-muted">
                  {compressionLevel === 'basic'
                    ? ws.basicCompressionHint
                    : ws.strongCompressionWarning}
                </p>
              </div>
            </>
          )}

          {error && <ToolErrorBanner message={error} />}

          <ToolPrimaryButton
            onClick={handleProcess}
            disabled={files.length === 0 || Boolean(error)}
            loading={processing}
            loadingLabel={ws.compressingPdf}
            loadingProgress={processing ? progress : undefined}
          >
            {ws.compressPdf}
          </ToolPrimaryButton>
        </>
      )}
    </ToolPageShell>
  );
}
