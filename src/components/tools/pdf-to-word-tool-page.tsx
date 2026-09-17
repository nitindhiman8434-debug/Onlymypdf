"use client";

import { useCallback, useRef, useState } from "react";
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
import { mapRelatedTools } from "@/components/tools/tool-helpers";
import { PdfPasswordModal } from "@/components/tools/pdf-password-modal";
import {
  isPasswordRequiredCode,
  isWrongPasswordCode,
} from "@/lib/client/pdf-password-errors";
import { notifyActivityUpdated } from "@/lib/client/activity-events";
import { useToolErrors } from "@/hooks/use-tool-errors";
import {
  createClient as createSupabaseBrowserClient,
  isSupabaseConfigured as isSupabaseBrowserConfigured,
} from "@/lib/supabase/client";

interface RelatedTool {
  name: string;
  href: string;
  color?: string;
}

function clientTimeoutMs(fileSizeBytes: number): number {
  const sizeMb = fileSizeBytes / (1024 * 1024);
  return Math.min(1_800_000, Math.max(900_000, 120_000 + Math.ceil(sizeMb) * 120_000));
}

function progressLabel(percent: number): string {
  if (percent >= 100) return "Finishing download…";
  if (percent >= 96) return "Saving Word document…";
  if (percent >= 92) return "Finalizing Word document…";
  if (percent >= 87) return `Extracting content… ${percent}%`;
  if (percent >= 12) return `Converting pages… ${percent}%`;
  if (percent >= 8) return `Converting with Microsoft Word… ${percent}%`;
  if (percent >= 5) return `Converting to Word… ${percent}%`;
  return "Preparing conversion…";
}

export function PdfToWordToolPage({
  relatedTools = [],
}: {
  relatedTools?: RelatedTool[];
}) {
  const { resolveApiError, resolveCatchError } = useToolErrors();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pdfPassword, setPdfPassword] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    errorMsg?: string;
    loading?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetResult = useCallback(() => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setCompleted(false);
    setResultUrl(null);
    setResultFilename(null);
    setResultSize(null);
    setProgress(0);
    setError(null);
  }, [resultUrl]);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const selected = Array.from(newFiles)[0];
      if (selected) {
        setFile(selected);
        setPdfPassword(null);
        resetResult();
      }
    },
    [resetResult]
  );

  const runConversion = async (password?: string | null) => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setError(null);

    const controller = new AbortController();
    const timeoutMs = clientTimeoutMs(file.size);
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    try {
      let startRes: Response;
      if (isSupabaseBrowserConfigured()) {
        setProgress(1);
        const signRes = await fetch("/api/uploads/pdf-to-word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf",
          }),
          signal: controller.signal,
        });
        if (!signRes.ok) {
          const err = (await signRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || "Could not prepare the secure upload.");
        }
        const signed = (await signRes.json()) as {
          path?: string;
          token?: string;
          uploadGrant?: string;
        };
        if (!signed.path || !signed.token || !signed.uploadGrant) {
          throw new Error("Server returned an incomplete secure upload response.");
        }

        const supabase = createSupabaseBrowserClient();
        const { error: uploadError } = await supabase.storage
          .from("pdf-files")
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: "application/pdf",
          });
        if (uploadError) throw new Error("Secure PDF upload failed. Please try again.");
        setProgress(4);

        startRes = await fetch("/api/tools/pdf-to-word", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Pdf-To-Word-Job": "1",
          },
          body: JSON.stringify({
            uploadGrant: signed.uploadGrant,
            options: password ? { password } : {},
          }),
          signal: controller.signal,
        });
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "options",
          JSON.stringify(password ? { password } : {})
        );

        startRes = await fetch("/api/tools/pdf-to-word", {
          method: "POST",
          body: formData,
          headers: { "X-Pdf-To-Word-Job": "1" },
          signal: controller.signal,
        });
      }

      if (!startRes.ok) {
        const err = (await startRes.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (isPasswordRequiredCode(err.code) || isWrongPasswordCode(err.code)) {
          setPasswordPrompt({
            fileName: file.name,
            errorMsg:
              isWrongPasswordCode(err.code)
                ? err.error || "Incorrect password."
                : undefined,
            loading: false,
          });
          return;
        }
        throw new Error(resolveApiError(err, "errors.processingFailed"));
      }

      const { jobId } = (await startRes.json()) as { jobId?: string };
      if (!jobId) {
        throw new Error("Server did not start conversion. Please retry.");
      }

      if (password) {
        setPdfPassword(password);
        setPasswordPrompt(null);
      }

      while (true) {
        const statusRes = await fetch(
          `/api/tools/pdf-to-word/status?jobId=${encodeURIComponent(jobId)}`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (!statusRes.ok) {
          const err = (await statusRes.json().catch(() => ({}))) as {
            error?: string;
          };
          if (statusRes.status === 403) {
            throw new Error(
              err.error ||
                "Session mismatch — refresh the page and try again."
            );
          }
          if (statusRes.status === 404) {
            throw new Error(
              err.error || "Conversion session expired. Please try again."
            );
          }
          throw new Error(
            err.error || "Lost conversion progress. Please try again."
          );
        }

        const status = (await statusRes.json()) as {
          progress: number;
          status: string;
          error?: string | null;
        };

        setProgress(Math.min(99, Math.max(0, status.progress ?? 0)));

        if (status.status === "error") {
          const errText = status.error || "Conversion failed.";
          if (
            errText === "PASSWORD_REQUIRED" ||
            errText.includes("PASSWORD_REQUIRED") ||
            errText.includes("password-protected")
          ) {
            setPasswordPrompt({ fileName: file.name, loading: false });
            return;
          }
          if (errText === "WRONG_PASSWORD" || /incorrect password/i.test(errText)) {
            setPasswordPrompt({
              fileName: file.name,
              errorMsg: "Incorrect password.",
              loading: false,
            });
            return;
          }
          throw new Error(errText);
        }

        if (status.status === "done") {
          break;
        }

        await sleep(1000);
      }

      const downloadRes = await fetch(
        `/api/tools/pdf-to-word/download?jobId=${encodeURIComponent(jobId)}`,
        { signal: controller.signal }
      );

      if (!downloadRes.ok) {
        throw new Error("Download failed. Please try again.");
      }

      const blob = await downloadRes.blob();
      const filename =
        file.name.replace(/\.pdf$/i, ".docx") || "converted.docx";

      setProgress(100);
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultFilename(filename);
      setResultSize(blob.size);
      setCompleted(true);
      notifyActivityUpdated();
    } catch (err) {
      setError(resolveCatchError(err));
    } finally {
      window.clearTimeout(timeoutId);
      setProcessing(false);
    }
  };

  const handleConvert = async () => {
    await runConversion(pdfPassword);
  };

  return (
    <>
    <ToolPageShell
      title="PDF to Word"
      description="Convert PDF documents to editable Word format"
      relatedTools={mapRelatedTools(relatedTools)}
    >
      {completed && resultUrl ? (
        <ToolSuccessPanel
          title="Converted Successfully!"
          description="Your Word document is ready to download."
          downloadUrl={resultUrl}
          downloadFilename={resultFilename || "converted.docx"}
          downloadLabel="Download DOCX"
          resultSizeBytes={resultSize ?? undefined}
          onReset={() => {
            resetResult();
            setFile(null);
          }}
        />
      ) : (
        <>
          <ToolDropzone
            hint="Drop a file here or click to browse"
            formatNote="Select a PDF file to convert to Word"
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
            fileInputAccept=".pdf,application/pdf"
            onFileInputChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-pd-brand-muted p-3">
              <FileText className="h-4 w-4 shrink-0 text-pd-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pd-foreground">{file.name}</p>
                <p className="text-xs text-pd-muted">{formatFileSize(file.size)}</p>
              </div>
            </div>
          )}

          <PdfPasswordInfoBanner className="mt-4" />
          {error && <ToolErrorBanner message={error} />}

          <ToolPrimaryButton
            onClick={handleConvert}
            disabled={!file}
            loading={processing}
            loadingLabel={progressLabel(progress)}
            loadingProgress={processing ? progress : undefined}
          >
            Convert to Word
          </ToolPrimaryButton>
        </>
      )}
    </ToolPageShell>
    {passwordPrompt && (
      <PdfPasswordModal
        fileName={passwordPrompt.fileName}
        errorMessage={passwordPrompt.errorMsg}
        loading={passwordPrompt.loading}
        onCancel={() => setPasswordPrompt(null)}
        onSubmit={(password) => {
          setPasswordPrompt((prev) =>
            prev ? { ...prev, loading: true, errorMsg: undefined } : prev
          );
          void runConversion(password);
        }}
      />
    )}
  </>
  );
}
