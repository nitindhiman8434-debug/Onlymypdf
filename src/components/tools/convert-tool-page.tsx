"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { formatFileSize } from "@/lib/utils/file";
import { ToolPageShell } from "@/components/layout/tool-page-shell";
import {
  ToolDropzone,
  ToolErrorBanner,
  ToolPrimaryButton,
  ToolSuccessPanel,
  PdfPasswordInfoBanner,
} from "@/components/tools/tool-ui";
import { PdfPasswordModal } from "@/components/tools/pdf-password-modal";
import { mapRelatedTools } from "@/components/tools/tool-helpers";
import { useToolErrors } from "@/hooks/use-tool-errors";
import { useConversionProgress } from "@/hooks/use-conversion-progress";
import {
  parseToolApiErrorPayload,
  passwordPromptFromError,
  type PasswordPromptState,
} from "@/lib/client/pdf-password-errors";

interface RelatedTool {
  name: string;
  href: string;
  color?: string;
}

interface ConvertToolPageProps {
  title: string;
  description: string;
  icon?: ReactNode;
  accept: string;
  uploadHint: string;
  processLabel: string;
  processingLabel: string;
  successTitle: string;
  successDescription: string;
  downloadLabel: string;
  outputExtension: string;
  apiPath: string;
  relatedTools?: RelatedTool[];
  extraFields?: ReactNode;
  buildFormData?: (file: File, formData: FormData) => FormData;
  /** Client fetch timeout in ms (default 120s). */
  fetchTimeoutMs?: number;
  /** Cap for fake progress bar while waiting on server (default 92). */
  progressCap?: number;
  /** Tick interval for simulated progress in ms (default 450). */
  progressIntervalMs?: number;
  /** Max creep progress after hitting cap (default 99). */
  progressStallCap?: number;
  /** Ms between +1% creep ticks after cap (default 3000). */
  progressStallIntervalMs?: number;
  /** Prompt for password when uploading encrypted PDFs. */
  supportsPdfPassword?: boolean;
}

export function ConvertToolPage({
  title,
  description,
  accept,
  uploadHint,
  processLabel,
  processingLabel,
  successTitle,
  successDescription,
  downloadLabel,
  outputExtension,
  apiPath,
  relatedTools = [],
  extraFields,
  buildFormData,
  fetchTimeoutMs = 120_000,
  progressCap = 92,
  progressIntervalMs,
  progressStallCap,
  progressStallIntervalMs,
  supportsPdfPassword = false,
}: ConvertToolPageProps) {
  const { resolveApiError, resolveCatchError } = useToolErrors();
  const { progress, start: startProgress, stop: stopProgress, complete: completeProgress, reset: resetProgress, advanceTo } =
    useConversionProgress({
      cap: progressCap,
      intervalMs: progressIntervalMs,
      stallCap: progressStallCap,
      stallIntervalMs: progressStallIntervalMs,
    });
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pdfPassword, setPdfPassword] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPromptState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetResult = useCallback(() => {
    setCompleted(false);
    setResultUrl(null);
    setResultFilename(null);
    setResultSize(null);
    resetProgress();
    setError(null);
    setPdfPassword(null);
    setPasswordPrompt(null);
  }, [resetProgress]);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const selected = Array.from(newFiles)[0];
      if (selected) {
        setFile(selected);
        resetResult();
      }
    },
    [resetResult]
  );

  const handleProcess = async (password?: string | null) => {
    if (!file) return;
    setProcessing(true);
    resetProgress();
    setError(null);
    startProgress();

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), fetchTimeoutMs);

    try {
      let formData = new FormData();
      formData.append("file", file);
      const pw = password ?? pdfPassword;
      if (supportsPdfPassword && pw) {
        formData.append("password", pw);
      }
      if (buildFormData) {
        formData = buildFormData(file, formData);
      }

      const res = await fetch(apiPath, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (supportsPdfPassword) {
          const passwordError = parseToolApiErrorPayload(
            typeof err === "object" && err ? (err as { error?: string; code?: string; fileName?: string }) : {}
          );
          if (passwordError) throw passwordError;
        }
        throw new Error(
          resolveApiError(
            typeof err === "object" && err && "error" in err
              ? (err as { error?: string; correlationId?: string })
              : undefined,
            "errors.processingFailed"
          )
        );
      }

      advanceTo(96);
      const blob = await res.blob();
      completeProgress();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultFilename(file.name.replace(/\.[^.]+$/, `.${outputExtension}`));
      setResultSize(blob.size);
      if (pw) setPdfPassword(pw);
      setPasswordPrompt(null);
      setCompleted(true);
    } catch (err) {
      if (supportsPdfPassword) {
        const prompt = passwordPromptFromError(err, file.name);
        if (prompt) {
          setPasswordPrompt(prompt);
          setError(null);
          return;
        }
      }
      setError(resolveCatchError(err));
    } finally {
      window.clearTimeout(timeoutId);
      stopProgress();
      setProcessing(false);
    }
  };

  return (
    <ToolPageShell
      title={title}
      description={description}
      relatedTools={mapRelatedTools(relatedTools)}
    >
      {completed && resultUrl ? (
        <ToolSuccessPanel
          title={successTitle}
          description={successDescription}
          downloadUrl={resultUrl}
          downloadFilename={resultFilename || `converted.${outputExtension}`}
          downloadLabel={downloadLabel}
          resultSizeBytes={resultSize ?? undefined}
          onReset={() => {
            resetResult();
            setFile(null);
          }}
        />
      ) : (
        <>
          {supportsPdfPassword && passwordPrompt && (
            <PdfPasswordModal
              fileName={passwordPrompt.fileName}
              errorMessage={passwordPrompt.errorMsg}
              loading={passwordPrompt.loading}
              onSubmit={(pw) => {
                setPdfPassword(pw);
                setPasswordPrompt(null);
                void handleProcess(pw);
              }}
              onCancel={() => {
                setPasswordPrompt(null);
                setFile(null);
                setPdfPassword(null);
              }}
            />
          )}

          <ToolDropzone
            hint="Drop a file here or click to browse"
            formatNote={uploadHint}
            dragOver={dragOver}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onChooseFiles={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            fileInputAccept={accept}
            onFileInputChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          {file && (
            <div className="mt-2 flex items-center gap-3 rounded-lg bg-pd-brand-muted p-3">
              <FileText className="h-4 w-4 shrink-0 text-pd-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pd-foreground">{file.name}</p>
                <p className="text-xs text-pd-muted">{formatFileSize(file.size)}</p>
              </div>
            </div>
          )}

          {extraFields && <div className="mt-2">{extraFields}</div>}
          {supportsPdfPassword && <PdfPasswordInfoBanner className="mt-3" />}
          {error && <ToolErrorBanner message={error} />}

          <ToolPrimaryButton
            onClick={() => void handleProcess()}
            disabled={!file}
            loading={processing}
            loadingLabel={processingLabel}
            loadingProgress={processing ? progress : undefined}
          >
            {processLabel}
          </ToolPrimaryButton>
        </>
      )}
    </ToolPageShell>
  );
}
