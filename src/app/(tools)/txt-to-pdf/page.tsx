"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileText,
  Layers,
  Loader2,
  Minimize2,
  Scissors,
  Settings2,
  Trash2,
  Type,
  Upload,
  X,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/file";
import { ToolResultSizeBadge, ToolHiddenFileInput, ToolUploadSizeHint } from "@/components/tools/tool-ui";
import { Button } from "@/components/ui/button";
import { PdfResultPreview } from "@/components/tools/pdf-result-preview";
import { useToolErrors } from "@/hooks/use-tool-errors";

type PageSize = "a4" | "letter";
type Orientation = "portrait" | "landscape";
type Margin = "none" | "small" | "medium";
type FontFamily = "courier" | "helvetica" | "times";

const ACCEPTED_EXTENSIONS = ".txt,.text,.log,.csv,.md,.json,.xml,.yaml,.yml,.ini,.cfg,.conf,.env";

const FONT_OPTIONS: { value: FontFamily; label: string; css: string }[] = [
  { value: "helvetica", label: "Helvetica", css: "font-sans" },
  { value: "courier", label: "Courier", css: "font-mono" },
  { value: "times", label: "Times", css: "font-serif" },
];

const FONT_SIZE_OPTIONS = [9, 10, 11, 12, 14, 16];

export default function TxtToPdfPage() {
  const { upload, resolveApiError, resolveCatchError } = useToolErrors();
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [previewTotalPages, setPreviewTotalPages] = useState(0);

  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margin, setMargin] = useState<Margin>("small");
  const [fontSize, setFontSize] = useState(11);
  const [fontFamily, setFontFamily] = useState<FontFamily>("helvetica");
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((picked: File) => {
    const ext = picked.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["txt", "text", "log", "csv", "md", "json", "xml", "yaml", "yml", "ini", "cfg", "conf", "env"];
    if (!allowed.includes(ext)) {
      setError(upload.textFilesOnly);
      return;
    }
    setFile(picked);
    setError(null);
    setCompleted(false);
    setResultUrl(null);
    setPreviewSessionId(null);
    setPreviewTotalPages(0);

    const reader = new FileReader();
    reader.onload = () => setTextContent(reader.result as string);
    reader.readAsText(picked);
  }, [upload]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleConvert = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("pageSize", pageSize);
      formData.append("orientation", orientation);
      formData.append("margin", margin);
      formData.append("fontSize", String(fontSize));
      formData.append("fontFamily", fontFamily);

      const res = await fetch("/api/tools/txt-to-pdf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(resolveApiError(data, "errors.processingFailed"));
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);
      setPreviewSessionId(res.headers.get("X-Pdf-Session-Id"));
      setPreviewTotalPages(
        parseInt(res.headers.get("X-Pdf-Total-Pages") ?? "0", 10) || 0
      );
      setCompleted(true);
    } catch (err) {
      setError(resolveCatchError(err));
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setTextContent(null);
    setCompleted(false);
    setResultUrl(null);
    setPreviewSessionId(null);
    setPreviewTotalPages(0);
    setResultSize(0);
    setPreviewSessionId(null);
    setPreviewTotalPages(0);
    setError(null);
  };

  const resultFileName = file?.name.replace(/\.[^.]+$/i, ".pdf") ?? "converted.pdf";
  const lineCount = textContent?.split("\n").length ?? 0;
  const charCount = textContent?.length ?? 0;
  const currentFont = FONT_OPTIONS.find((f) => f.value === fontFamily) ?? FONT_OPTIONS[0];

  /* ─── Result View ─── */
  if (completed && resultUrl) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <PdfResultPreview
          blobUrl={resultUrl}
          filename={resultFileName}
          fileSize={resultSize}
          initialSessionId={previewSessionId}
          initialTotalPages={previewTotalPages}
          onReset={reset}
          resetLabel="Convert another file"
        />
      </div>
    );
  }

  /* ─── Main Upload / Preview UI ─── */
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-pd-brand shadow-lg shadow-pd-brand/20">
          <Type className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">TXT to PDF</h1>
        <p className="mt-1.5 text-sm text-pd-muted">
          Convert text files to professionally formatted PDF documents
        </p>
      </div>

      {!file ? (
        /* ─── Dropzone ─── */
        <div
          className={cn(
            "mx-auto max-w-2xl cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200",
            dragOver
              ? "border-pd-brand bg-pd-brand-muted shadow-lg shadow-pd-brand/10"
              : "border-gray-200 bg-white hover:border-pd-brand/40 hover:bg-pd-brand-muted/30 hover:shadow-md"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pd-brand-muted">
            <Upload className="h-7 w-7 text-pd-brand" />
          </div>
          <p className="text-lg font-semibold text-gray-700">
            Drop your text file here
          </p>
          <p className="mt-1 text-sm text-pd-muted">
            or click to browse · Supports TXT, LOG, CSV, MD, JSON, XML, YAML, INI
          </p>
          <ToolUploadSizeHint className="mt-2 text-center text-pd-muted" />
          <button
            type="button"
            className="mt-5 rounded-xl bg-pd-brand px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-pd-brand/20 transition-all hover:bg-pd-brand-hover hover:shadow-lg hover:shadow-pd-brand/30"
          >
            Choose File
          </button>
        </div>
      ) : (
        /* ─── File loaded: Preview + Settings + Convert ─── */
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Top bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-white px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pd-brand-muted">
                <FileText className="h-4.5 w-4.5 text-pd-brand" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">{file.name}</p>
                <p className="text-xs text-pd-muted">
                  {formatFileSize(file.size)} · {lineCount.toLocaleString()} lines · {charCount.toLocaleString()} chars
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  showSettings
                    ? "border-pd-brand/30 bg-pd-brand-muted text-pd-brand"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <Settings2 className="h-4 w-4" />
                Settings
              </button>

              <button
                type="button"
                onClick={reset}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-pd-muted transition-colors hover:bg-gray-100 hover:text-pd-foreground"
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Settings panel (collapsible) */}
          {showSettings && (
            <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-pd-muted">Page Size</h3>
                  <div className="flex gap-2">
                    {(["a4", "letter"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPageSize(v)}
                        className={cn(
                          "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all",
                          pageSize === v
                            ? "border-pd-brand/30 bg-pd-brand-muted text-pd-brand shadow-sm"
                            : "border-gray-200 text-pd-muted hover:border-gray-300"
                        )}
                      >
                        {v === "a4" ? "A4" : "Letter"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-pd-muted">Orientation</h3>
                  <div className="flex gap-2">
                    {(["portrait", "landscape"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setOrientation(v)}
                        className={cn(
                          "rounded-lg border px-3.5 py-1.5 text-sm font-medium capitalize transition-all",
                          orientation === v
                            ? "border-pd-brand/30 bg-pd-brand-muted text-pd-brand shadow-sm"
                            : "border-gray-200 text-pd-muted hover:border-gray-300"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-pd-muted">Margin</h3>
                  <div className="flex gap-2">
                    {(["none", "small", "medium"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setMargin(v)}
                        className={cn(
                          "rounded-lg border px-3.5 py-1.5 text-sm font-medium capitalize transition-all",
                          margin === v
                            ? "border-pd-brand/30 bg-pd-brand-muted text-pd-brand shadow-sm"
                            : "border-gray-200 text-pd-muted hover:border-gray-300"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-pd-muted">Font</h3>
                  <div className="flex gap-2">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFontFamily(f.value)}
                        className={cn(
                          "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all",
                          f.css,
                          fontFamily === f.value
                            ? "border-pd-brand/30 bg-pd-brand-muted text-pd-brand shadow-sm"
                            : "border-gray-200 text-pd-muted hover:border-gray-300"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-pd-muted">Font Size</h3>
                  <div className="flex gap-1.5">
                    {FONT_SIZE_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFontSize(s)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-all",
                          fontSize === s
                            ? "border-pd-brand/30 bg-pd-brand-muted text-pd-brand shadow-sm"
                            : "border-gray-200 text-pd-muted hover:border-gray-300"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live text preview */}
          <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-5 py-5">
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-pd-muted" />
              <span className="text-xs font-semibold uppercase tracking-wider text-pd-muted">
                Live Preview
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
              {textContent ? (
                <pre
                  className={cn(
                    "max-h-[50vh] overflow-auto whitespace-pre-wrap break-words p-6 text-gray-800",
                    currentFont.css
                  )}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.4 }}
                >
                  {textContent.length > 50000
                    ? textContent.slice(0, 50000) + "\n\n… (preview truncated)"
                    : textContent}
                </pre>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-pd-muted">
                  Loading preview…
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-5 mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <span>{error}</span>
            </div>
          )}

          {/* Convert button */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-white px-5 py-4">
            <p className="hidden text-sm text-pd-muted sm:block">
              Text will be formatted with {currentFont.label} {fontSize}pt on {pageSize.toUpperCase()} {orientation}
            </p>
            <Button
              onClick={handleConvert}
              disabled={processing || !file}
              className="gap-2 rounded-xl bg-pd-brand px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-pd-brand/20 transition-all hover:bg-pd-brand-hover hover:shadow-lg hover:shadow-pd-brand/30"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Converting…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Convert to PDF
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <ToolHiddenFileInput
        ref={fileInputRef}
        accept={ACCEPTED_EXTENSIONS}
        ariaLabel="Choose text file to convert"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) handleFile(picked);
        }}
      />

      {/* Features section */}
      <div className="mx-auto mt-12 max-w-3xl">
        <h2 className="mb-6 text-center text-xl font-bold text-gray-900">
          Why use our TXT to PDF converter?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Type, title: "Font Options", desc: "Choose from Helvetica, Courier, or Times fonts with adjustable sizes from 9pt to 16pt" },
            { icon: Eye, title: "Live Preview", desc: "See your text rendered before converting — the font and size you pick is what you get" },
            { icon: Settings2, title: "Customizable Layout", desc: "Page size (A4, Letter), orientation, margins — full control over your PDF output" },
            { icon: FileText, title: "Any Text Format", desc: "TXT, LOG, CSV, MD, JSON, XML, YAML, INI — converts any text-based file to PDF" },
            { icon: Layers, title: "Word Wrapping", desc: "Long lines are intelligently wrapped to fit the page — no content is lost or cut off" },
            { icon: CheckCircle2, title: "Privacy First", desc: "Files processed securely and auto-deleted after 2 hours — your data stays private" },
          ].map((feat) => (
            <div
              key={feat.title}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-pd-brand-muted">
                <feat.icon className="h-4.5 w-4.5 text-pd-brand" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">{feat.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-pd-muted">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
