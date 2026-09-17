"use client";

import { forwardRef, useId, type ChangeEvent, type InputHTMLAttributes, type RefObject } from "react";
import { Loader2, Download, AlertCircle, Upload, FileUp, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/file";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { useTranslation } from "@/i18n";
import { formatUploadSizeDisplay, useToolUploadSizeLine } from "@/hooks/use-tool-upload-limits";

export function ToolUploadSizeHint({
  formatNote,
  className,
}: {
  formatNote?: string;
  className?: string;
}) {
  const sizeLine = useToolUploadSizeLine();
  return (
    <div className={cn("space-y-0.5 text-xs text-pd-muted/90", className)}>
      {formatNote ? <p>{formatNote}</p> : null}
      <p className="text-balance">{formatUploadSizeDisplay(sizeLine)}</p>
    </div>
  );
}

/** Shown on PDF tools that prompt for a password via PdfPasswordModal. */
export function PdfPasswordInfoBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg bg-pd-brand-muted/50 p-3 text-sm text-pd-foreground",
        className
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-pd-brand" aria-hidden />
      <p>{t("toolPage.pdfPasswordUploadHint")}</p>
    </div>
  );
}

export function ToolResultSizeBadge({
  sizeBytes,
  className,
}: {
  sizeBytes: number;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex w-full justify-center", className)}>
      <span className="inline-flex items-center gap-2 rounded-full border border-pd-border/80 bg-pd-background px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
        {t("toolPage.outputSize")}
        <span className="font-bold tabular-nums text-slate-900">
          {formatFileSize(sizeBytes)}
        </span>
      </span>
    </div>
  );
}

interface ToolDropzoneProps {
  hint?: string;
  /** Optional format/type note; upload size line is appended automatically. */
  formatNote?: string;
  /** Full override — skips automatic size hint. */
  subHint?: string;
  /** Show plan upload size line (default true). */
  showSizeHint?: boolean;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onChooseFiles: () => void;
  chooseLabel?: string;
  className?: string;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  fileInputAccept?: string;
  fileInputMultiple?: boolean;
  onFileInputChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function ToolDropzone({
  hint,
  formatNote,
  subHint,
  showSizeHint = true,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onChooseFiles,
  chooseLabel,
  className,
  fileInputRef,
  fileInputAccept,
  fileInputMultiple,
  onFileInputChange,
}: ToolDropzoneProps) {
  const { t } = useTranslation();
  const sizeLine = useToolUploadSizeLine();
  const zoneId = useId();
  const resolvedChooseLabel = chooseLabel ?? t("toolPage.selectFile");
  const resolvedHint = hint ?? t("toolPage.orDragDropFile");

  return (
    <div className={cn("w-full", className)}>
      <div
        role="region"
        aria-labelledby={zoneId}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-3 text-center transition-colors duration-200",
          dragOver
            ? "border-pd-brand bg-pd-brand-muted/80"
            : "border-pd-border bg-pd-background hover:border-pd-brand/40 hover:bg-pd-brand-muted/30"
        )}
      >
        <div
          className={cn(
            "mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            dragOver ? "bg-pd-brand text-white" : "bg-pd-brand-muted text-pd-brand"
          )}
        >
          <Upload className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>

        <Button type="button" size="md" className="gap-2" onClick={onChooseFiles}>
          <FileUp className="h-4 w-4" aria-hidden />
          {resolvedChooseLabel}
        </Button>

        <p id={zoneId} className="mt-1.5 text-sm text-pd-muted">
          {resolvedHint}
        </p>
        {subHint ? (
          <p className="mt-0.5 text-xs text-pd-muted/90 text-balance">
            {formatUploadSizeDisplay(subHint)}
          </p>
        ) : (
          <div className="mt-0.5 space-y-0.5">
            {formatNote ? (
              <p className="text-xs text-pd-muted/90">{formatNote}</p>
            ) : null}
            {showSizeHint ? (
              <p className="text-xs text-pd-muted/90 text-balance">
                {formatUploadSizeDisplay(sizeLine)}
              </p>
            ) : null}
          </div>
        )}
      </div>
      {fileInputRef ? (
        <ToolHiddenFileInput
          ref={fileInputRef}
          accept={fileInputAccept}
          multiple={fileInputMultiple}
          onChange={onFileInputChange}
          labelledBy={zoneId}
          ariaLabel={t("toolPage.chooseFileAria")}
        />
      ) : null}
    </div>
  );
}

type ToolHiddenFileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  ariaLabel: string;
  labelledBy?: string;
};

/** Screen-reader accessible off-screen file input for tool pages and workspaces. */
export const ToolHiddenFileInput = forwardRef<HTMLInputElement, ToolHiddenFileInputProps>(
  function ToolHiddenFileInput({ ariaLabel, labelledBy, type = "file", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        {...props}
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        className="sr-only"
        tabIndex={-1}
      />
    );
  }
);

export function ToolErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mt-3 flex w-full items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

interface ToolSuccessPanelProps {
  title: string;
  description?: string;
  downloadUrl: string;
  downloadFilename: string;
  downloadLabel: string;
  resultSizeBytes?: number;
  originalSizeBytes?: number;
  savedPercent?: number;
  onReset: () => void;
  resetLabel?: string;
  children?: React.ReactNode;
}

function FileSizeComparison({
  originalSizeBytes,
  resultSizeBytes,
  savedPercent,
}: {
  originalSizeBytes: number;
  resultSizeBytes: number;
  savedPercent?: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-5 w-full rounded-2xl border border-pd-border bg-pd-background p-4">
      <div
        className={cn(
          "grid items-center gap-3",
          savedPercent !== undefined
            ? "grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr]"
            : "grid-cols-1 sm:grid-cols-[1fr_auto_1fr]"
        )}
      >
        <div className="rounded-xl border border-pd-border/80 bg-pd-surface px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-pd-muted">{t("toolPage.sizeOriginal")}</p>
          <p className="mt-1 text-base font-bold tabular-nums text-pd-foreground">
            {formatFileSize(originalSizeBytes)}
          </p>
        </div>
        <div className="hidden text-lg text-pd-muted sm:block" aria-hidden>
          &rarr;
        </div>
        <div className="rounded-xl border border-pd-brand/25 bg-pd-brand-muted/50 px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-pd-muted">{t("toolPage.sizeOutput")}</p>
          <p className="mt-1 text-base font-bold tabular-nums text-pd-brand">
            {formatFileSize(resultSizeBytes)}
          </p>
        </div>
        {savedPercent !== undefined && (
          <>
            <div className="hidden h-10 w-px bg-pd-border sm:block" aria-hidden />
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/80">{t("toolPage.sizeSaved")}</p>
              <p className="mt-1 text-base font-bold tabular-nums text-emerald-700">
                {savedPercent}%
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ToolSuccessPanel({
  title,
  description,
  downloadUrl,
  downloadFilename,
  downloadLabel,
  resultSizeBytes,
  originalSizeBytes,
  savedPercent,
  onReset,
  resetLabel,
  children,
  iconVariant = "download",
}: ToolSuccessPanelProps & { iconVariant?: "download" | "success" }) {
  const { t } = useTranslation();
  const resolvedResetLabel = resetLabel ?? t("toolPage.processAnother");
  const showComparison =
    originalSizeBytes !== undefined &&
    originalSizeBytes > 0 &&
    resultSizeBytes !== undefined &&
    resultSizeBytes > 0;
  const showSizeBadge =
    !showComparison && resultSizeBytes !== undefined && resultSizeBytes > 0;

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-full",
          iconVariant === "success" ? "bg-emerald-100" : "bg-pd-brand-muted"
        )}
      >
        {iconVariant === "success" ? (
          <Check className="h-7 w-7 text-emerald-600" aria-hidden />
        ) : (
          <Download className="h-7 w-7 text-pd-brand" aria-hidden />
        )}
      </div>
      <h2 className="w-full text-lg font-bold text-pd-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 w-full text-sm leading-relaxed text-pd-muted">{description}</p>
      ) : null}

      {showComparison ? (
        <FileSizeComparison
          originalSizeBytes={originalSizeBytes}
          resultSizeBytes={resultSizeBytes}
          savedPercent={savedPercent}
        />
      ) : null}

      {children ? <div className="mt-4 w-full text-left">{children}</div> : null}

      <div className="mt-6 flex w-full flex-col items-center gap-3">
        {showSizeBadge ? <ToolResultSizeBadge sizeBytes={resultSizeBytes} /> : null}
        <a href={downloadUrl} download={downloadFilename}>
          <Button size="lg" className="h-11 min-w-[13rem] gap-2 px-8 font-semibold">
            <Download className="h-4 w-4" />
            {downloadLabel}
          </Button>
        </a>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-pd-muted transition hover:text-pd-foreground"
        >
          {resolvedResetLabel}
        </button>
      </div>
    </div>
  );
}

interface ToolWorkspaceReadyPanelProps {
  title?: string;
  description: string;
  downloadUrl: string;
  downloadFilename: string;
  downloadLabel?: string;
  resultSizeBytes?: number;
  resetLabel: string;
  onReset: () => void;
}

export function ToolWorkspaceReadyPanel({
  title,
  description,
  downloadUrl,
  downloadFilename,
  downloadLabel,
  resultSizeBytes,
  resetLabel,
  onReset,
}: ToolWorkspaceReadyPanelProps) {
  const { t } = useTranslation();

  return (
    <ToolSuccessPanel
      title={title ?? t("toolPage.pdfReady")}
      description={description}
      downloadUrl={downloadUrl}
      downloadFilename={downloadFilename}
      downloadLabel={downloadLabel ?? t("toolPage.download")}
      resultSizeBytes={resultSizeBytes}
      resetLabel={resetLabel}
      onReset={onReset}
      iconVariant="success"
    />
  );
}

interface ToolPrimaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  loadingProgress?: number;
  children: React.ReactNode;
  className?: string;
}

export function ToolPrimaryButton({
  onClick,
  disabled,
  loading,
  loadingLabel,
  loadingProgress,
  children,
  className,
}: ToolPrimaryButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      size="md"
      className={cn("mt-2 h-10 w-full font-semibold", className)}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2.5">
          {typeof loadingProgress === "number" ? (
            <CircularProgress value={loadingProgress} size={30} strokeWidth={2.5} />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
