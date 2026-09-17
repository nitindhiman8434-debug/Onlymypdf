"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Sparkles,
  Upload,
  Download,
  Loader2,
  CheckCircle,
  Copy,
  Check,
  AlertCircle,
  LogIn,
  FileText,
  ListChecks,
  CalendarDays,
  Lightbulb,
  Target,
  BookOpen,
  Clock3,
  Layers,
  ChevronDown,
  Volume2,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ToolPageShell } from "@/components/layout/tool-page-shell";
import { ToolHiddenFileInput, ToolUploadSizeHint } from "@/components/tools/tool-ui";
import { mapRelatedTools } from "@/components/tools/tool-helpers";
import {
  cleanSummaryText,
  getDetailedDisplayBlocks,
  getExecutiveSummaryText,
  type SummaryDisplayBlock,
} from "@/lib/ai/sanitize-summary";
import { useToolErrors } from "@/hooks/use-tool-errors";
import { isPasswordRequiredCode } from "@/lib/client/pdf-password-errors";

interface SummaryResult {
  documentTitle?: string;
  topics?: string[];
  shortSummary: string;
  detailedSummary: string;
  keyPoints: string[];
  actionItems: string[];
  importantDates: string[];
  metadata?: {
    mode?: string;
    pageCount?: number;
    characterCount?: number;
    processingTimeMs?: number;
  };
}

const RELATED_TOOLS = [
  { name: "PDF to Word", href: "/pdf-to-word" },
  { name: "Compress PDF", href: "/compress-pdf" },
  { name: "Merge PDF", href: "/merge-pdf" },
  { name: "Unlock PDF", href: "/unlock-pdf" },
];

export default function AIPDFSummarizerPage() {
  const { resolveApiError, resolveCatchError, messages } = useToolErrors();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data?.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError("");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setResult(null);
      setError("");
    }
  };

  const handleSummarize = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    setProgress(20);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setProgress(40);
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      setProgress(70);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (isPasswordRequiredCode(err.code)) {
          throw new Error(messages.pdfPasswordRequired);
        }
        throw new Error(resolveApiError(err, "toolPage.errors.summarizationFailed"));
      }

      const data = await res.json();
      setResult(data);
      setProgress(100);
    } catch (err) {
      setError(resolveCatchError(err, { timeoutKey: "toolPage.errors.summarizationFailed" }));
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const downloadSummary = async (format: "txt" | "docx" | "pdf") => {
    if (!result) return;

    setDownloadingFormat(format);

    try {
      const res = await fetch("/api/ai/summarize/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          summary: {
            ...result,
            sourceFileName: file?.name,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(resolveApiError(err, "toolPage.errors.downloadFailed"));
      }

      const blob = await res.blob();
      const extension = format === "docx" ? "docx" : format === "pdf" ? "pdf" : "txt";
      const baseName = (result.documentTitle || "pdf-summary")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "pdf-summary";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseName}-summary.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(resolveCatchError(err, { timeoutKey: "toolPage.errors.downloadFailed" }));
    } finally {
      setDownloadingFormat(null);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    setProgress(0);
  };

  if (isLoggedIn === false) {
    return (
      <ToolPageShell
        title="AI PDF Summarizer"
        description="Upload a PDF and get a clear summary, key points, and action items."
        relatedTools={mapRelatedTools(RELATED_TOOLS)}
        compactWorkspace
      >
        <div className="max-w-md mx-auto text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pd-brand-muted">
            <LogIn className="h-8 w-8 text-pd-brand" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-pd-foreground">Login Required</h2>
          <p className="mt-3 text-pd-muted">
            AI PDF Summarizer requires a free account. Sign up to get 1 free AI summary per day.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <a href="/login" className="rounded-xl bg-pd-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
              Login
            </a>
            <a href="/signup" className="rounded-xl border border-pd-border px-6 py-3 text-sm font-semibold text-pd-foreground hover:bg-pd-background">
              Sign Up Free
            </a>
          </div>
        </div>
      </ToolPageShell>
    );
  }

  return (
    <ToolPageShell
      title="AI PDF Summarizer"
      description="Upload a PDF and get a clear summary, key points, and action items. Free users: 1 AI summary/day | Pro users: Unlimited"
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      compactWorkspace
    >
        {!result ? (
          <div>
            {!file ? (
              <div
                role="region"
                aria-label="Upload PDF for AI summarization"
                className={`rounded-xl border-2 border-dashed p-9 text-center transition-colors ${
                  isDragging ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-purple-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-10 w-10 text-pd-muted" />
                <p className="mt-3 text-base font-medium text-gray-700">Drag & drop your PDF here</p>
                <p className="mt-1 text-sm text-pd-muted">or click to select a file</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 cursor-pointer"
                >
                  Select PDF File
                </button>
                <ToolHiddenFileInput
                  ref={fileInputRef}
                  accept="application/pdf"
                  ariaLabel="Choose PDF file to summarize"
                  onChange={handleFileChange}
                />
                <ToolUploadSizeHint formatNote="PDF only" className="mt-3 text-center text-pd-muted" />
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                  <FileText className="h-8 w-8 shrink-0 text-purple-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-pd-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button onClick={reset} className="text-sm text-red-600 hover:text-red-700 cursor-pointer">Remove</button>
                </div>

                {error && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
                  </div>
                )}

                {processing ? (
                  <div className="py-6 text-center" aria-live="polite" aria-busy="true">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-600" />
                    <p className="mt-3 font-medium text-gray-700">AI is analyzing your document...</p>
                    <div className="mx-auto mt-3 max-w-xs">
                      <div
                        className="h-2 rounded-full bg-gray-200"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        aria-label="Summarization progress"
                      >
                        <div className="h-2 rounded-full bg-purple-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-pd-muted">{progress}%</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSummarize}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-base font-semibold text-white hover:bg-purple-700"
                  >
                    <Sparkles className="h-5 w-5" /> Summarize with AI
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <SummaryReport
            result={result}
            fileName={file?.name}
            onCopy={copyToClipboard}
            copiedSection={copiedSection}
            onDownload={downloadSummary}
            downloadingFormat={downloadingFormat}
            onReset={reset}
          />
        )}
    </ToolPageShell>
  );
}

function SummaryReport({
  result,
  fileName,
  onCopy,
  copiedSection,
  onDownload,
  downloadingFormat,
  onReset,
}: {
  result: SummaryResult;
  fileName?: string;
  onCopy: (text: string, section: string) => void;
  copiedSection: string | null;
  onDownload: (format: "txt" | "docx" | "pdf") => Promise<void>;
  downloadingFormat: string | null;
  onReset: () => void;
}) {
  const executiveSummary = getExecutiveSummaryText(result.shortSummary);
  const detailedBlocks = getDetailedDisplayBlocks(result.detailedSummary);
  const detailedListenText = detailedBlocks
    .map((block) =>
      block.type === "point" ? `${block.label}. ${block.content}` : block.content
    )
    .join(". ");
  const [listeningSection, setListeningSection] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleListen = (sectionKey: string, text: string, title?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (listeningSection === sectionKey) {
      window.speechSynthesis.cancel();
      setListeningSection(null);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      title ? `${title}. ${text}` : text
    );
    utterance.lang = /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => setListeningSection(null);
    utterance.onerror = () => setListeningSection(null);

    setListeningSection(sectionKey);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                <CheckCircle className="h-3.5 w-3.5" />
                Analysis complete
              </div>
              <h2 className="text-2xl font-bold sm:text-3xl">
                {result.documentTitle || "Executive Summary Report"}
              </h2>
              {fileName && (
                <p className="mt-2 flex items-center gap-2 text-sm text-purple-100">
                  <FileText className="h-4 w-4" />
                  {fileName}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <DownloadFormatMenu
                onDownload={onDownload}
                downloadingFormat={downloadingFormat}
              />
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.speechSynthesis.cancel();
                  }
                  setListeningSection(null);
                  onReset();
                }}
                className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                New Summary
              </button>
            </div>
          </div>

          {result.topics && result.topics.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {result.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-px bg-gray-100 sm:grid-cols-3">
          <StatPill
            icon={Layers}
            label="Pages analyzed"
            value={String(result.metadata?.pageCount ?? "-")}
          />
          <StatPill
            icon={BookOpen}
            label="Characters read"
            value={result.metadata?.characterCount?.toLocaleString() ?? "-"}
          />
          <StatPill
            icon={Clock3}
            label="Processing time"
            value={
              result.metadata?.processingTimeMs
                ? `${(result.metadata.processingTimeMs / 1000).toFixed(1)}s`
                : "-"
            }
          />
        </div>
      </div>

      {result.metadata?.mode === "local-fallback" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Generated in local development mode. Add a valid GEMINI_API_KEY for full AI summaries.
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeader
          icon={Target}
          title="Executive Summary"
          subtitle="High-level overview of the document"
          copyText={executiveSummary}
          listenText={executiveSummary}
          sectionKey="executive"
          onCopy={onCopy}
          copied={copiedSection}
          listeningSection={listeningSection}
          onListen={toggleListen}
        />
        <div className="mt-5 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-white px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[17px] leading-[1.85] text-gray-800">{executiveSummary}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeader
          icon={BookOpen}
          title="Detailed Analysis"
          subtitle="Structured breakdown of the main ideas"
          copyText={detailedBlocks
            .map((block) =>
              block.type === "point" ? `${block.label}: ${block.content}` : block.content
            )
            .join("\n\n")}
          listenText={detailedListenText}
          sectionKey="detailed"
          onCopy={onCopy}
          copied={copiedSection}
          listeningSection={listeningSection}
          onListen={toggleListen}
        />
        <div className="mt-5 space-y-4">
          {detailedBlocks.map((block, index) => (
            <SummaryDisplayBlockCard key={`${block.type}-${index}`} block={block} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {result.keyPoints.length > 0 && (
          <InsightCard
            icon={Lightbulb}
            iconClassName="text-amber-600 bg-amber-50"
            title="Key Insights"
            subtitle="Most important takeaways"
            items={result.keyPoints}
            numbered
            sectionKey="keyPoints"
            onCopy={onCopy}
            copied={copiedSection}
            listeningSection={listeningSection}
            onListen={toggleListen}
          />
        )}

        {result.actionItems.length > 0 && (
          <InsightCard
            icon={ListChecks}
            iconClassName="text-emerald-600 bg-emerald-50"
            title="Recommended Actions"
            subtitle="Next steps mentioned in the document"
            items={result.actionItems}
            sectionKey="actionItems"
            onCopy={onCopy}
            copied={copiedSection}
            listeningSection={listeningSection}
            onListen={toggleListen}
          />
        )}
      </div>

      {result.importantDates.length > 0 && (
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <SectionHeader
            icon={CalendarDays}
            title="Dates & Metrics"
            subtitle="Important timelines and numbers"
            copyText={result.importantDates.join("\n")}
            listenText={result.importantDates.join(". ")}
            sectionKey="dates"
            onCopy={onCopy}
            copied={copiedSection}
            listeningSection={listeningSection}
            onListen={toggleListen}
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {result.importantDates.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-700"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryDisplayBlockCard({ block }: { block: SummaryDisplayBlock }) {
  if (block.type === "point") {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 sm:px-5 sm:py-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">
          {block.label}
        </h4>
        <p className="mt-2 text-[15px] leading-[1.8] text-gray-700">{block.content}</p>
      </div>
    );
  }

  return (
    <p className="rounded-2xl border border-gray-100 bg-white px-4 py-4 text-[15px] leading-[1.8] text-gray-700 sm:px-5 sm:py-5">
      {block.content}
    </p>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white px-5 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-pd-muted">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  copyText,
  listenText,
  sectionKey,
  onCopy,
  copied,
  listeningSection,
  onListen,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  copyText: string;
  listenText: string;
  sectionKey: string;
  onCopy: (text: string, section: string) => void;
  copied: string | null;
  listeningSection: string | null;
  onListen: (sectionKey: string, text: string, title?: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-pd-muted">{subtitle}</p>
        </div>
      </div>
      <SectionActions
        copyText={copyText}
        listenText={listenText}
        listenTitle={title}
        sectionKey={sectionKey}
        onCopy={onCopy}
        copied={copied}
        listeningSection={listeningSection}
        onListen={onListen}
      />
    </div>
  );
}

function InsightCard({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  items,
  numbered = false,
  sectionKey,
  onCopy,
  copied,
  listeningSection,
  onListen,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  title: string;
  subtitle: string;
  items: string[];
  numbered?: boolean;
  sectionKey: string;
  onCopy: (text: string, section: string) => void;
  copied: string | null;
  listeningSection: string | null;
  onListen: (sectionKey: string, text: string, title?: string) => void;
}) {
  const listenText = items
    .map((item, index) => (numbered ? `${index + 1}. ${cleanSummaryText(item)}` : cleanSummaryText(item)))
    .join(". ");

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", iconClassName)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-pd-muted">{subtitle}</p>
          </div>
        </div>
        <SectionActions
          copyText={items.join("\n")}
          listenText={listenText}
          listenTitle={title}
          sectionKey={sectionKey}
          onCopy={onCopy}
          copied={copied}
          listeningSection={listeningSection}
          onListen={onListen}
        />
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-700"
          >
            {numbered ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-semibold text-white">
                {index + 1}
              </span>
            ) : (
              <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
            )}
            <span>{cleanSummaryText(item)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DownloadFormatMenu({
  onDownload,
  downloadingFormat,
}: {
  onDownload: (format: "txt" | "docx" | "pdf") => Promise<void>;
  downloadingFormat: string | null;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [
    { id: "pdf" as const, label: "PDF Document", hint: ".pdf" },
    { id: "docx" as const, label: "Word Document", hint: ".docx" },
    { id: "txt" as const, label: "Text File", hint: ".txt" },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Download summary"
        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
      >
        {downloadingFormat ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={!!downloadingFormat}
              onClick={async () => {
                setOpen(false);
                await onDownload(option.id);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-pd-muted">{option.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionActions({
  copyText,
  listenText,
  listenTitle,
  sectionKey,
  onCopy,
  copied,
  listeningSection,
  onListen,
}: {
  copyText: string;
  listenText: string;
  listenTitle?: string;
  sectionKey: string;
  onCopy: (text: string, section: string) => void;
  copied: string | null;
  listeningSection: string | null;
  onListen: (sectionKey: string, text: string, title?: string) => void;
}) {
  const isListening = listeningSection === sectionKey;

  return (
    <div className="flex items-center gap-1">
      <ListenButton
        isListening={isListening}
        onClick={() => onListen(sectionKey, listenText, listenTitle)}
      />
      <CopyButton text={copyText} section={sectionKey} onCopy={onCopy} copied={copied} />
    </div>
  );
}

function ListenButton({
  isListening,
  onClick,
}: {
  isListening: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-lg px-2 py-1 text-xs cursor-pointer transition-colors",
        isListening
          ? "bg-purple-100 text-purple-700"
          : "text-pd-muted hover:bg-gray-100"
      )}
      title={isListening ? "Stop listening" : "Listen to this section"}
      aria-label={isListening ? "Stop listening" : "Listen to this section"}
      aria-pressed={isListening}
    >
      {isListening ? (
        <Square className="h-3 w-3 fill-current" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
      {isListening ? "Stop" : "Listen"}
    </button>
  );
}

function CopyButton({
  text,
  section,
  onCopy,
  copied,
}: {
  text: string;
  section: string;
  onCopy: (text: string, section: string) => void;
  copied: string | null;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(text, section)}
      aria-label={copied === section ? "Copied to clipboard" : "Copy section to clipboard"}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-pd-muted hover:bg-gray-100 cursor-pointer"
    >
      {copied === section ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied === section ? "Copied" : "Copy"}
    </button>
  );
}
