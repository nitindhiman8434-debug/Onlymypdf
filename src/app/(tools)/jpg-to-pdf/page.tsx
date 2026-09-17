'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, RotateCw, Copy, ZoomIn, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import { PdfResultPreview } from '@/components/tools/pdf-result-preview';
import {
  ToolDropzone,
  ToolErrorBanner,
  ToolHiddenFileInput,
} from '@/components/tools/tool-ui';
import { useToolErrors } from '@/hooks/use-tool-errors';
import { Button } from '@/components/ui/button';
import { CircularProgress } from '@/components/ui/circular-progress';
import { useConversionProgress } from '@/hooks/use-conversion-progress';
import { runClientOrServerPdfExport } from '@/lib/pdf/client-pdf-export';
import { imagesToPdfInBrowser } from '@/lib/pdf/pdf-browser';

const RELATED_TOOLS = [
  { name: 'PDF to Word', href: '/pdf-to-word' },
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Compress PDF', href: '/compress-pdf' },
  { name: 'Word to PDF', href: '/word-to-pdf' },
];

const FAQS = [
  { q: 'What image formats are supported?', a: 'We support JPEG/JPG, PNG, and WebP image formats.' },
  { q: 'Can I convert multiple images into one PDF?', a: 'Yes! Upload multiple images and they will all be combined into a single PDF document. You can reorder them before converting.' },
  { q: 'Can I choose the page size?', a: 'Yes, you can choose between A4, US Letter, or Auto (which matches the image dimensions).' },
  { q: 'Is there a limit on the number of images?', a: 'You can convert up to 50 images at once into a single PDF.' },
];

type PageSize = 'a4' | 'letter' | 'auto';
type Orientation = 'portrait' | 'landscape';
type Margin = 'none' | 'small' | 'medium';

function isImageFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    /\.(jpe?g|png|webp)$/i.test(name)
  );
}

function OptionPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
        active
          ? 'bg-pd-brand text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {children}
    </button>
  );
}

export default function JpgToPdfPage() {
  const { upload, resolveApiError, resolveCatchError } = useToolErrors();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [margin, setMargin] = useState<Margin>('small');
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);
  const insertAfterIndexRef = useRef<number | null>(null);
  const { progress, start: startProgress, complete: completeProgress, stop: stopProgress, reset: resetProgress } =
    useConversionProgress({ cap: 92 });

  const insertFilesAt = useCallback((newFiles: FileList | File[], afterIndex: number | null) => {
    const imageFiles = Array.from(newFiles).filter(isImageFile);
    if (imageFiles.length === 0) {
      setError(upload.imagesOnly);
      return;
    }

    const newPreviews = imageFiles.map(f => URL.createObjectURL(f));
    const insertAt =
      afterIndex === null || afterIndex < 0 ? null : afterIndex + 1;

    setFiles(prev => {
      if (insertAt === null) return [...prev, ...imageFiles];
      const next = [...prev];
      next.splice(insertAt, 0, ...imageFiles);
      return next;
    });
    setPreviews(prev => {
      if (insertAt === null) return [...prev, ...newPreviews];
      const next = [...prev];
      next.splice(insertAt, 0, ...newPreviews);
      return next;
    });
    setError(null);
    setCompleted(false);
    setResultUrl(null);
  }, [upload]);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => insertFilesAt(newFiles, null),
    [insertFilesAt]
  );

  const openInsertAt = useCallback((afterIndex: number | null) => {
    insertAfterIndexRef.current = afterIndex;
    addMoreRef.current?.click();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const rotateFile = (index: number) => {
    setRotations(prev => ({ ...prev, [index]: ((prev[index] ?? 0) + 90) % 360 }));
  };

  const duplicateFile = (index: number) => {
    const newPreview = URL.createObjectURL(files[index]);
    setFiles(prev => [...prev.slice(0, index + 1), prev[index], ...prev.slice(index + 1)]);
    setPreviews(prev => [...prev.slice(0, index + 1), newPreview, ...prev.slice(index + 1)]);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    startProgress();

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("pageSize", pageSize);
      formData.append("orientation", orientation);
      formData.append("margin", margin === "medium" ? "normal" : margin);

      const { blob } = await runClientOrServerPdfExport({
        tool: 'jpg-to-pdf',
        client: async () =>
          imagesToPdfInBrowser(files, {
            pageSize,
            orientation,
            margin: margin === 'medium' ? 'medium' : margin,
          }),
        server: async () => {
          const res = await fetch('/api/tools/jpg-to-pdf', { method: 'POST', body: formData });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(resolveApiError(err, 'errors.processingFailed'));
          }
          return res.blob();
        },
      });

      completeProgress();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultFilename('images.pdf');
      setResultSize(blob.size);
      setCompleted(true);
    } catch (err) {
      setError(resolveCatchError(err));
      stopProgress();
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    resetProgress();
    previews.forEach(p => URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
    setCompleted(false);
    setResultUrl(null);
    setResultSize(0);
    setError(null);
  };

  const hasFiles = files.length > 0;
  const pageAspect = orientation === 'landscape' ? 1.414 : 0.707;

  return (
    <>
    <ToolPageShell
      title="JPG to PDF"
      description="Convert images to PDF document"
      fullWidthWorkspace={hasFiles || completed}
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      faqs={mapFaqs(FAQS)}
    >
      {completed && resultUrl ? (
        <PdfResultPreview
          blobUrl={resultUrl}
          filename={resultFilename || 'images.pdf'}
          fileSize={resultSize}
          onReset={reset}
          resetLabel="Convert more images"
        />
      ) : !hasFiles ? (
        <>
          <ToolDropzone
            hint="Drop images here or click to browse"
            formatNote="Supports JPG, PNG, and WebP"
            dragOver={dragOver}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onChooseFiles={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            fileInputAccept="image/jpeg,image/png,image/webp"
            fileInputMultiple
            onFileInputChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (picked.length > 0) handleFiles(picked);
            }}
          />
          
        </>
      ) : (
        <div>
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              onClick={() => openInsertAt(files.length > 0 ? files.length - 1 : null)}
              className="flex items-center gap-1.5 rounded-lg bg-pd-brand/10 px-3 py-1.5 text-xs font-semibold text-pd-brand transition hover:bg-pd-brand/20"
            >
              <Plus className="h-3.5 w-3.5" /> Add more
            </button>
            <ToolHiddenFileInput
              ref={addMoreRef}
              accept="image/jpeg,image/png,image/webp"
              multiple
              ariaLabel="Add more images"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (picked.length === 0) return;
                const afterIndex = insertAfterIndexRef.current;
                insertAfterIndexRef.current = null;
                insertFilesAt(picked, afterIndex);
              }}
            />

            <span className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5">
              {([['a4', 'A4'], ['letter', 'Letter'], ['auto', 'Auto']] as const).map(([v, l]) => (
                <OptionPill key={v} active={pageSize === v} onClick={() => setPageSize(v)}>{l}</OptionPill>
              ))}
            </div>

            <span className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5">
              {([['portrait', 'Portrait'], ['landscape', 'Landscape']] as const).map(([v, l]) => (
                <OptionPill key={v} active={orientation === v} onClick={() => setOrientation(v)}>{l}</OptionPill>
              ))}
            </div>

            <span className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5">
              {([['none', 'No margin'], ['small', 'Small'], ['medium', 'Medium']] as const).map(([v, l]) => (
                <OptionPill key={v} active={margin === v} onClick={() => setMargin(v)}>{l}</OptionPill>
              ))}
            </div>

            <div className="ml-auto">
              <Button
                onClick={handleProcess}
                disabled={processing}
                className="gap-2"
              >
                {processing ? (
                  <>
                    <CircularProgress value={progress} size={28} strokeWidth={2.5} className="text-white" />
                    Converting…
                  </>
                ) : (
                  <>
                    Finish
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && <div className="mb-4"><ToolErrorBanner message={error} /></div>}

          {/* Image cards grid */}
          <div className="flex flex-wrap items-start gap-y-4">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-stretch">
                {/* Page card */}
                <div className="group relative w-[160px] sm:w-[180px]">
                  <div
                    className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                    style={{ aspectRatio: pageSize === 'auto' ? undefined : pageAspect }}
                  >
                    <img
                      src={previews[index]}
                      alt={file.name}
                      className={cn(
                        "h-full w-full transition-transform",
                        pageSize === 'auto' ? 'object-cover' : 'object-contain',
                        margin === 'none' ? 'p-0' : margin === 'small' ? 'p-2' : 'p-4'
                      )}
                      style={rotations[index] ? { transform: `rotate(${rotations[index]}deg)` } : undefined}
                    />
                    <div className="absolute inset-x-0 top-0 flex justify-center gap-1 bg-gradient-to-b from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" onClick={() => setZoomIndex(index)} className="rounded-md bg-white/90 p-1.5 shadow-sm hover:bg-white" title="Zoom">
                        <ZoomIn className="h-3.5 w-3.5 text-slate-700" />
                      </button>
                      <button type="button" onClick={() => rotateFile(index)} className="rounded-md bg-white/90 p-1.5 shadow-sm hover:bg-white" title="Rotate">
                        <RotateCw className="h-3.5 w-3.5 text-slate-700" />
                      </button>
                      <button type="button" onClick={() => duplicateFile(index)} className="rounded-md bg-white/90 p-1.5 shadow-sm hover:bg-white" title="Duplicate">
                        <Copy className="h-3.5 w-3.5 text-slate-700" />
                      </button>
                      <button type="button" onClick={() => removeFile(index)} className="rounded-md bg-white/90 p-1.5 shadow-sm hover:bg-red-50" title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 truncate text-center text-[11px] font-medium text-pd-muted">{file.name}</p>
                </div>

                {/* "+" button between cards */}
                <div className="flex items-center px-1">
                  <button
                    type="button"
                    onClick={() => openInsertAt(index)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-110 hover:bg-emerald-600"
                    title="Add image here"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add more card at end */}
            <div className="w-[160px] sm:w-[180px]">
              <button
                type="button"
                onClick={() => openInsertAt(files.length > 0 ? files.length - 1 : null)}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-pd-brand hover:bg-pd-brand/5 hover:text-pd-brand"
                style={{ aspectRatio: pageSize === 'auto' ? '0.707' : pageAspect }}
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-medium">Add images</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ToolPageShell>
    {zoomIndex !== null && previews[zoomIndex] && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={() => setZoomIndex(null)}
      >
        <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
          <img
            src={previews[zoomIndex]}
            alt={files[zoomIndex]?.name}
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
            style={rotations[zoomIndex] ? { transform: `rotate(${rotations[zoomIndex]}deg)` } : undefined}
          />
          <button
            type="button"
            onClick={() => setZoomIndex(null)}
            className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
      </div>
    )}
    </>
  );
}
