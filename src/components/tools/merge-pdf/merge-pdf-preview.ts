import { loadPdfDocumentPreview } from "@/lib/pdf/pdf-thumbnails.client";
import type { MergeFileItem } from "@/components/tools/merge-pdf/merge-file-types";

export type MergePasswordPromptState = {
  itemId: string;
  file: File;
  fileName: string;
  errorMsg?: string;
  loading?: boolean;
} | null;

export function mergeFileKey(file: File): string {
  return `${file.name}\0${file.size}\0${file.lastModified}`;
}

export function mergeItemIdForFile(file: File): string {
  return `merge-${file.name}-${file.size}-${file.lastModified}`;
}

/** Survives React Strict Mode remounts — keyed by file fingerprint. */
const rejectedFileKeys = new Set<string>();
const startedFileKeys = new Set<string>();
const inFlightFileKeys = new Set<string>();
const generationByFileKey = new Map<string, number>();

function bumpFileGeneration(fileKey: string) {
  const next = (generationByFileKey.get(fileKey) ?? 0) + 1;
  generationByFileKey.set(fileKey, next);
  return next;
}

export function allowMergeFilePreview(file: File) {
  const fileKey = mergeFileKey(file);
  rejectedFileKeys.delete(fileKey);
  startedFileKeys.delete(fileKey);
}

export function rejectMergeFilePreview(file: File) {
  const fileKey = mergeFileKey(file);
  rejectedFileKeys.add(fileKey);
  startedFileKeys.add(fileKey);
  bumpFileGeneration(fileKey);
  inFlightFileKeys.delete(fileKey);
}

type PreviewHandlers = {
  incorrectPassword: string;
  isItemActive: (itemId: string) => boolean;
  onPasswordRequired: (prompt: NonNullable<MergePasswordPromptState>) => void;
  onPasswordWrong: (prompt: NonNullable<MergePasswordPromptState>) => void;
  onPreviewReady: (itemId: string, update: Partial<MergeFileItem>) => void;
  onPreviewError: (message: string) => void;
};

export async function runMergeFilePreview(
  itemId: string,
  file: File,
  handlers: PreviewHandlers,
  password?: string
) {
  const fileKey = mergeFileKey(file);
  if (rejectedFileKeys.has(fileKey)) return;
  if (!password) {
    if (startedFileKeys.has(fileKey)) return;
    startedFileKeys.add(fileKey);
  }
  if (inFlightFileKeys.has(fileKey)) return;

  const generation = bumpFileGeneration(fileKey);
  inFlightFileKeys.add(fileKey);

  try {
    const preview = await loadPdfDocumentPreview(file, password);

    if (rejectedFileKeys.has(fileKey)) return;
    if (generationByFileKey.get(fileKey) !== generation) return;
    if (!handlers.isItemActive(itemId)) return;

    if (preview.passwordRequired && !password) {
      handlers.onPreviewReady(itemId, { loadingThumb: false });
      handlers.onPasswordRequired({
        itemId,
        file,
        fileName: preview.fileName ?? file.name,
      });
      return;
    }

    if (preview.wrongPassword) {
      handlers.onPasswordWrong({
        itemId,
        file,
        fileName: preview.fileName ?? file.name,
        errorMsg: preview.error ?? handlers.incorrectPassword,
        loading: false,
      });
      return;
    }

    if (!preview.sessionId || preview.totalPages === 0) {
      handlers.onPreviewError(preview.error ?? "Could not read this PDF.");
      handlers.onPreviewReady(itemId, { loadingThumb: false });
      return;
    }

    handlers.onPreviewReady(itemId, {
      loadingThumb: false,
      pageCount: preview.totalPages,
      thumbUrl: preview.thumbUrl || undefined,
      sessionId: preview.sessionId || undefined,
      ...(password ? { password } : {}),
    });
  } finally {
    inFlightFileKeys.delete(fileKey);
  }
}
