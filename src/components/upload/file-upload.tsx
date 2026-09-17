"use client";

import * as React from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Progress } from "@/components/ui/progress";
import { FileCard, type FileCardFile } from "@/components/upload/file-card";
import { PrivacyBadge } from "@/components/common/privacy-badge";
import { FILE_LIMITS, isUnlimitedFileSizeMB } from "@/config/constants";
import { uploadDropzoneSizeLabel } from "@/lib/billing/billing-copy";
import { useToolErrors } from "@/hooks/use-tool-errors";

type UploadState = "idle" | "dragging" | "uploading" | "uploaded" | "error";

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  onFilesSelected?: (files: File[]) => void;
  uploadProgress?: number;
  className?: string;
}

export function FileUpload({
  accept = ".pdf",
  maxSizeMB = FILE_LIMITS.maxFreeFileSizeMB,
  multiple = false,
  onFilesSelected,
  uploadProgress,
  className,
}: FileUploadProps) {
  const { errors } = useToolErrors();
  const [state, setState] = React.useState<UploadState>("idle");
  const [files, setFiles] = React.useState<FileCardFile[]>([]);
  const [rawFiles, setRawFiles] = React.useState<File[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const helpId = React.useId();
  const errorId = React.useId();

  const unlimited = isUnlimitedFileSizeMB(maxSizeMB);
  const maxSizeBytes = unlimited ? Number.MAX_SAFE_INTEGER : maxSizeMB * 1024 * 1024;

  function validateAndSetFiles(incoming: File[]) {
    const validFiles: File[] = [];
    const cards: FileCardFile[] = [];

    for (const f of incoming) {
      if (!unlimited && f.size > maxSizeBytes) {
        setErrorMsg(errors.fileTooBig(maxSizeMB));
        continue;
      }
      validFiles.push(f);
      cards.push({ name: f.name, size: f.size, status: "idle" });
    }

    if (validFiles.length > 0) {
      setFiles(cards);
      setRawFiles(validFiles);
      setState("uploaded");
      setErrorMsg(null);
      onFilesSelected?.(validFiles);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState("dragging");
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState("idle");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState("idle");
    const dropped = Array.from(e.dataTransfer.files);
    if (!multiple && dropped.length > 1) {
      validateAndSetFiles([dropped[0]]);
    } else {
      validateAndSetFiles(dropped);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    validateAndSetFiles(selected);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    const newFiles = files.filter((_, i) => i !== index);
    const newRaw = rawFiles.filter((_, i) => i !== index);
    setFiles(newFiles);
    setRawFiles(newRaw);
    if (newFiles.length === 0) {
      setState("idle");
    }
  }

  const isUploading = uploadProgress !== undefined && uploadProgress < 100;

  return (
    <div className={cn("w-full max-w-xl mx-auto", className)}>
      {files.length === 0 ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="sr-only"
            tabIndex={-1}
            aria-label={multiple ? "Choose files" : "Choose a file"}
            aria-describedby={errorMsg ? `${helpId} ${errorId}` : helpId}
          />
          <button
            type="button"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            aria-describedby={errorMsg ? `${helpId} ${errorId}` : helpId}
            className={cn(
              "relative flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand focus-visible:ring-offset-2",
              state === "dragging"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            )}
          >
            <div
            className={cn(
              "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
              state === "dragging"
                ? "bg-blue-100 text-blue-600"
                : "bg-red-50 text-red-600"
            )}
            >
            {state === "dragging" ? (
              <Upload className="h-7 w-7" aria-hidden="true" />
            ) : (
              <FileText className="h-7 w-7" aria-hidden="true" />
            )}
            </div>
            <span className="text-base font-semibold text-gray-900">
            {state === "dragging"
              ? "Drop your files here"
              : "Drag & drop your files here"}
            </span>
            <span className="mt-1 text-sm text-pd-muted">
            or click to select files
            </span>
            <span id={helpId} className="mt-3 text-xs text-pd-muted">
            {uploadDropzoneSizeLabel(maxSizeMB)}
            </span>
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {files.map((file, idx) => (
            <FileCard
              key={`${file.name}-${idx}`}
              file={file}
              onRemove={() => removeFile(idx)}
            />
          ))}

          {!multiple && files.length < 1 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm text-pd-muted transition-colors hover:border-gray-400 hover:text-pd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand focus-visible:ring-offset-2"
            >
              Add another file
            </button>
          )}
          {multiple && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm text-pd-muted transition-colors hover:border-gray-400 hover:text-pd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand focus-visible:ring-offset-2"
            >
              Add more files
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="sr-only"
            tabIndex={-1}
            aria-label={multiple ? "Choose files" : "Choose a file"}
            aria-describedby={errorMsg ? errorId : undefined}
          />
        </div>
      )}

      {isUploading && (
        <div className="mt-4">
          <Progress value={uploadProgress} label="File upload progress" showPercentage />
        </div>
      )}

      {errorMsg && (
        <p id={errorId} className="mt-3 text-center text-sm text-red-600" role="alert">
          {errorMsg}
        </p>
      )}

      <div className="mt-4 flex justify-center">
        <PrivacyBadge />
      </div>
    </div>
  );
}
