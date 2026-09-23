"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/file";
import { ToolPageShell } from "@/components/layout/tool-page-shell";
import { WatermarkPreview } from "@/components/tools/previews/watermark-preview";
import {
  ToolDropzone,
  ToolErrorBanner,
  ToolHiddenFileInput,
  ToolPrimaryButton,
  ToolSuccessPanel,
} from "@/components/tools/tool-ui";
import { useToolErrors } from "@/hooks/use-tool-errors";

const DEFAULT_WATERMARK_COLOR = "#64748b";
const BLACK_WATERMARK_COLOR = "#000000";

export default function AddWatermarkPage() {
  const { resolveApiError, resolveCatchError } = useToolErrors();
  const [file, setFile] = useState<File | null>(null);
  const [watermarkType, setWatermarkType] = useState<"text" | "image">("text");
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.5);
  const [color, setColor] = useState(BLACK_WATERMARK_COLOR);
  const [fontSize, setFontSize] = useState(48);
  const [rotation, setRotation] = useState(-35);
  const [imageScale, setImageScale] = useState(0.35);
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const customColorInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const [pageRotationDelta, setPageRotationDelta] = useState<Record<number, number>>({});
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState(1);

  const handleDocumentReady = useCallback((total: number) => {
    setTotalPages(total);
    setVisiblePages(Array.from({ length: total }, (_, i) => i + 1));
    setPageRotationDelta({});
    setCurrentDisplayIndex(1);
  }, []);

  const handleRotatePage = useCallback((originalPageNum: number) => {
    setPageRotationDelta((prev) => ({
      ...prev,
      [originalPageNum]: (prev[originalPageNum] ?? 0) - 90,
    }));
  }, []);

  const handleDeletePage = useCallback((originalPageNum: number) => {
    setVisiblePages((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p !== originalPageNum);
      setCurrentDisplayIndex((idx) => Math.min(idx, next.length));
      return next;
    });
    setPageRotationDelta((prev) => {
      const next = { ...prev };
      delete next[originalPageNum];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!file) {
      setTotalPages(0);
      setVisiblePages([]);
      setPageRotationDelta({});
      setCurrentDisplayIndex(1);
    }
  }, [file]);

  useEffect(() => {
    if (!watermarkImage) {
      setImagePreviewUrl(null);
      return;
    }

    setImageScale(0.35);
    const url = URL.createObjectURL(watermarkImage);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [watermarkImage]);

  const removeWatermarkImage = useCallback(() => {
    setWatermarkImage(null);
    setImageScale(0.35);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, []);

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);

    try {
      let pdfToWatermark: File = file;

      const rotations: Record<number, number> = {};
      for (const pageNum of visiblePages) {
        const delta = pageRotationDelta[pageNum] ?? 0;
        if (delta !== 0) rotations[pageNum] = delta;
      }

      if (Object.keys(rotations).length > 0) {
        const rotateForm = new FormData();
        rotateForm.append("file", pdfToWatermark, pdfToWatermark.name);
        rotateForm.append("rotations", JSON.stringify(rotations));
        const rotateRes = await fetch("/api/tools/rotate-pdf", { method: "POST", body: rotateForm });
        if (!rotateRes.ok) {
          const data = await rotateRes.json().catch(() => ({}));
          throw new Error(resolveApiError(data, "errors.processingFailed"));
        }
        const rotatedBlob = await rotateRes.blob();
        pdfToWatermark = new File([rotatedBlob], file.name, { type: "application/pdf" });
      }

      if (totalPages > 0 && visiblePages.length < totalPages) {
        const composeForm = new FormData();
        composeForm.append("file", pdfToWatermark, pdfToWatermark.name);
        composeForm.append(
          "slots",
          JSON.stringify(visiblePages.map((page) => ({ kind: "original" as const, page })))
        );
        const composeRes = await fetch("/api/tools/compose-pdf", { method: "POST", body: composeForm });
        if (!composeRes.ok) {
          const data = await composeRes.json().catch(() => ({}));
          throw new Error(resolveApiError(data, "errors.processingFailed"));
        }
        const composedBlob = await composeRes.blob();
        pdfToWatermark = new File([composedBlob], file.name, { type: "application/pdf" });
      }

      const formData = new FormData();
      formData.append("file", pdfToWatermark);
      formData.append(
        "options",
        JSON.stringify({
          type: watermarkType,
          text: watermarkType === "text" ? (text.trim() || "CONFIDENTIAL") : undefined,
          opacity,
          fontSize,
          rotation,
          imageScale: watermarkType === "image" ? imageScale : undefined,
          color: watermarkType === "text" ? color : "#64748b",
          pages: "all",
        })
      );

      if (watermarkType === "image" && watermarkImage) {
        formData.append("watermarkImage", watermarkImage);
      }

      const res = await fetch("/api/tools/add-watermark", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(resolveApiError(err, "errors.processingFailed"));
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setResultFilename(file.name.replace(/\.pdf$/i, "-watermarked.pdf"));
      setResultSize(blob.size);
      setCompleted(true);
      const { notifyActivityUpdated } = await import("@/lib/client/activity-events");
      notifyActivityUpdated();
    } catch (err) {
      setError(resolveCatchError(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolPageShell
      title="Add Watermark to PDF"
      description="Stamp text or image watermarks on every page"
      splitWorkspace={!completed}
      previewPlaceholder="Upload a PDF to preview watermark placement"
      preview={
        !completed ? (
          <WatermarkPreview
            file={file}
            watermarkType={watermarkType}
            text={text}
            opacity={opacity}
            fontSize={fontSize}
            rotation={rotation}
            imagePreviewUrl={imagePreviewUrl}
            imageScale={imageScale}
            onImageScaleChange={setImageScale}
            onRotationChange={setRotation}
            onRemoveWatermarkImage={removeWatermarkImage}
            onFontSizeChange={setFontSize}
            onClearText={() => setText("")}
            color={color}
            visiblePages={visiblePages}
            pageRotationDelta={pageRotationDelta}
            currentDisplayIndex={currentDisplayIndex}
            onDocumentReady={handleDocumentReady}
            onCurrentDisplayIndexChange={setCurrentDisplayIndex}
            onRotatePage={handleRotatePage}
            onDeletePage={handleDeletePage}
            onPageActionError={setError}
          />
        ) : undefined
      }
    >
      {completed && resultUrl ? (
        <ToolSuccessPanel
          title="Watermark applied!"
          description="Your watermarked PDF is ready to download."
          downloadUrl={resultUrl}
          downloadFilename={resultFilename || "watermarked.pdf"}
          downloadLabel="Download PDF"
          originalSizeBytes={file?.size}
          resultSizeBytes={resultSize}
          resetLabel="Watermark another file"
          onReset={() => {
            setCompleted(false);
            setFile(null);
            setResultUrl(null);
            setResultSize(0);
          }}
        />
      ) : (
        <>
          <ToolDropzone
            hint="or drop files here"
            formatNote="PDF only"
            dragOver={dragOver}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setFile(f);
                setCompleted(false);
              }
            }}
            onChooseFiles={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            fileInputAccept=".pdf,application/pdf"
            onFileInputChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setCompleted(false);
            }}
          />
          {file ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-pd-border bg-pd-brand-muted px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-pd-foreground">{file.name}</p>
              <p className="shrink-0 text-xs text-pd-muted">{formatFileSize(file.size)}</p>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["text", "image"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setWatermarkType(type)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition",
                  watermarkType === type
                    ? "border-pd-brand bg-pd-brand-muted text-pd-brand"
                    : "border-pd-border text-pd-muted hover:bg-pd-background"
                )}
              >
                {type} watermark
              </button>
            ))}
          </div>

          {watermarkType === "text" ? (
            <div className="mt-4">
              <label
                htmlFor="watermark-text"
                className="mb-1.5 block text-sm font-medium text-pd-foreground"
              >
                Watermark text
              </label>
              <input
                id="watermark-text"
                name="watermarkText"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-xl border border-pd-border px-4 py-2.5 text-sm outline-none focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20"
                placeholder="CONFIDENTIAL"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-1.5 block text-sm font-medium text-pd-foreground">
                Watermark image (PNG/JPG)
              </p>
              {watermarkImage ? (
                <div className="flex items-center gap-2 rounded-xl border border-pd-border bg-pd-background px-3 py-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="min-w-0 flex-1 truncate text-left text-sm text-pd-foreground hover:text-pd-brand"
                    title={watermarkImage.name}
                  >
                    {watermarkImage.name}
                  </button>
                  <button
                    type="button"
                    onClick={removeWatermarkImage}
                    className="shrink-0 rounded-lg p-1.5 text-pd-muted transition hover:bg-red-50 hover:text-red-600"
                    title="Remove image"
                    aria-label="Remove watermark image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full rounded-xl border border-pd-border px-4 py-2.5 text-left text-sm text-pd-muted hover:bg-pd-background"
                >
                  Choose image
                </button>
              )}
              <ToolHiddenFileInput
                ref={imageInputRef}
                accept="image/png,image/jpeg,image/webp"
                ariaLabel="Choose watermark image"
                onChange={(e) => setWatermarkImage(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="watermark-opacity"
                className="mb-1.5 block text-sm font-medium text-pd-foreground"
              >
                Opacity <span className="text-pd-muted">({Math.round(opacity * 100)}%)</span>
              </label>
              <input
                id="watermark-opacity"
                name="watermarkOpacity"
                type="range"
                min={0.1}
                max={0.8}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-pd-brand"
              />
              {watermarkType === "text" && (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-xs text-pd-muted">Color</span>
                  <button
                    type="button"
                    onClick={() => setColor(BLACK_WATERMARK_COLOR)}
                    className={cn(
                      "h-7 w-7 shrink-0 rounded-full border-2 transition",
                      color === BLACK_WATERMARK_COLOR
                        ? "border-pd-brand ring-2 ring-pd-brand/30"
                        : "border-pd-border hover:border-pd-brand/50"
                    )}
                    style={{ backgroundColor: BLACK_WATERMARK_COLOR }}
                    title="Black"
                    aria-label="Black watermark color"
                  />
                  <button
                    type="button"
                    onClick={() => setColor(DEFAULT_WATERMARK_COLOR)}
                    className={cn(
                      "h-7 w-7 shrink-0 rounded-full border-2 transition",
                      color === DEFAULT_WATERMARK_COLOR
                        ? "border-pd-brand ring-2 ring-pd-brand/30"
                        : "border-pd-border hover:border-pd-brand/50"
                    )}
                    style={{ backgroundColor: DEFAULT_WATERMARK_COLOR }}
                    title="Gray"
                    aria-label="Gray watermark color"
                  />
                  <button
                    type="button"
                    onClick={() => customColorInputRef.current?.click()}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-white text-pd-muted transition hover:border-pd-brand/50",
                      color !== DEFAULT_WATERMARK_COLOR && color !== BLACK_WATERMARK_COLOR
                        ? "border-pd-brand ring-2 ring-pd-brand/30"
                        : "border-pd-border"
                    )}
                    style={
                      color !== DEFAULT_WATERMARK_COLOR && color !== BLACK_WATERMARK_COLOR
                        ? { backgroundColor: color }
                        : undefined
                    }
                    title="Custom color"
                    aria-label="Choose custom watermark color"
                  >
                    {color === DEFAULT_WATERMARK_COLOR || color === BLACK_WATERMARK_COLOR ? (
                      <Plus className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                  <input
                    ref={customColorInputRef}
                    id="watermark-custom-color"
                    name="watermarkCustomColor"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                  />
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="watermark-font-size"
                className="mb-1.5 block text-sm font-medium text-pd-foreground"
              >
                Font size
              </label>
              <input
                id="watermark-font-size"
                name="watermarkFontSize"
                type="number"
                min={18}
                max={96}
                value={fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setFontSize(v);
                }}
                className="w-full rounded-xl border border-pd-border px-3 py-2 text-sm"
                disabled={watermarkType === "image"}
              />
            </div>
            <div>
              <label
                htmlFor="watermark-rotation"
                className="mb-1.5 block text-sm font-medium text-pd-foreground"
              >
                Rotation
              </label>
              <input
                id="watermark-rotation"
                name="watermarkRotation"
                type="number"
                min={-90}
                max={90}
                value={rotation}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setRotation(v);
                }}
                className="w-full rounded-xl border border-pd-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error && <ToolErrorBanner message={error} />}

          <ToolPrimaryButton
            onClick={handleProcess}
            disabled={!file || (watermarkType === "image" && !watermarkImage)}
            loading={processing}
            loadingLabel="Adding watermark..."
          >
            Apply Watermark
          </ToolPrimaryButton>
        </>
      )}
    </ToolPageShell>
  );
}
