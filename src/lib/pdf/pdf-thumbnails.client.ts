"use client";

import {
  isPasswordRequiredPayload,
  isWrongPasswordPayload,
} from "@/lib/client/pdf-password-errors";

const MAX_THUMBNAIL_PAGES = 500;

function appendPdfToForm(formData: FormData, file: File) {
  formData.append("file", file, file.name || "document.pdf");
}

export interface PdfSessionResult {
  sessionId: string;
  totalPages: number;
  truncated: boolean;
  error?: string;
  /** Set when the PDF requires a password before it can be opened. */
  passwordRequired?: boolean;
  /** Set when the supplied password was incorrect. */
  wrongPassword?: boolean;
  fileName?: string;
}

async function createPdfSession(
  file: File,
  password?: string
): Promise<PdfSessionResult> {
  const formData = new FormData();
  appendPdfToForm(formData, file);
  if (password) {
    formData.append("password", password);
  }

  try {
    const res = await fetch("/api/tools/pdf-session", {
      method: "POST",
      body: formData,
    });
    const data = (await res.json()) as {
      sessionId?: string;
      totalPages?: number;
      truncated?: boolean;
      error?: string;
      code?: string;
      fileName?: string;
    };

    if (!res.ok) {
      if (isPasswordRequiredPayload(data)) {
        return {
          sessionId: "",
          totalPages: 0,
          truncated: false,
          passwordRequired: true,
          fileName: data.fileName ?? file.name,
        };
      }
      if (isWrongPasswordPayload(data)) {
        return {
          sessionId: "",
          totalPages: 0,
          truncated: false,
          wrongPassword: true,
          error: data.error ?? "Incorrect password.",
        };
      }
      return {
        sessionId: "",
        totalPages: 0,
        truncated: false,
        error: data.error ?? `Server error (${res.status})`,
      };
    }

    if (!data.sessionId || !data.totalPages) {
      return {
        sessionId: "",
        totalPages: 0,
        truncated: false,
        error: data.error ?? "Could not read this PDF.",
      };
    }

    return {
      sessionId: data.sessionId,
      totalPages: data.totalPages,
      truncated: Boolean(data.truncated),
    };
  } catch (err) {
    return {
      sessionId: "",
      totalPages: 0,
      truncated: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

function thumbUrl(sessionId: string, pageNum: number, width?: number): string {
  const base = `/api/tools/pdf-thumb?session=${encodeURIComponent(sessionId)}&page=${pageNum}`;
  if (width && width !== 300) {
    return `${base}&width=${width}`;
  }
  return base;
}

export async function loadPdfThumbnailsBatched(
  file: File,
  onBatch: (thumbnails: string[], totalPages: number, truncated: boolean) => void,
  password?: string
): Promise<{ totalPages: number; error?: string; passwordRequired?: boolean; wrongPassword?: boolean }> {
  if (!file || file.size === 0) {
    return { totalPages: 0, error: "File is empty." };
  }

  const session = await createPdfSession(file, password);
  if (session.passwordRequired) {
    return { totalPages: 0, passwordRequired: true };
  }
  if (session.wrongPassword) {
    return { totalPages: 0, wrongPassword: true, error: session.error };
  }
  if (!session.sessionId || session.totalPages === 0) {
    return {
      totalPages: 0,
      error: session.error ?? "Could not read this PDF. Try another file.",
    };
  }

  const totalPages = session.totalPages;
  const pagesToLoad = Math.min(totalPages, MAX_THUMBNAIL_PAGES);
  const truncated = session.truncated || totalPages > MAX_THUMBNAIL_PAGES;

  const allThumbnails = Array.from({ length: pagesToLoad }, (_, i) =>
    thumbUrl(session.sessionId, i + 1)
  );

  const INITIAL_BATCH = 20;
  const PROGRESS_BATCH = 24;

  if (pagesToLoad <= INITIAL_BATCH) {
    onBatch(allThumbnails, totalPages, truncated);
    return { totalPages };
  }

  onBatch(allThumbnails.slice(0, INITIAL_BATCH), totalPages, truncated);

  let loaded = INITIAL_BATCH;
  const pump = () => {
    if (loaded >= pagesToLoad) return;
    loaded = Math.min(loaded + PROGRESS_BATCH, pagesToLoad);
    onBatch(allThumbnails.slice(0, loaded), totalPages, truncated);
    if (loaded < pagesToLoad) {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(pump, { timeout: 250 });
      } else {
        window.setTimeout(pump, 16);
      }
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(pump, { timeout: 250 });
  } else {
    window.setTimeout(pump, 16);
  }

  return { totalPages };
}

/** First-page preview + page count for document cards (merge, file list). */
export async function loadPdfDocumentPreview(file: File, password?: string): Promise<{
  sessionId: string;
  totalPages: number;
  thumbUrl: string;
  truncated: boolean;
  error?: string;
  passwordRequired?: boolean;
  wrongPassword?: boolean;
  fileName?: string;
}> {
  const session = await createPdfSession(file, password);
  if (session.passwordRequired) {
    return {
      sessionId: "",
      totalPages: 0,
      thumbUrl: "",
      truncated: false,
      passwordRequired: true,
      fileName: session.fileName ?? file.name,
    };
  }
  if (session.wrongPassword) {
    return {
      sessionId: "",
      totalPages: 0,
      thumbUrl: "",
      truncated: false,
      wrongPassword: true,
      error: session.error,
    };
  }
  if (!session.sessionId || session.totalPages === 0) {
    return {
      sessionId: "",
      totalPages: 0,
      thumbUrl: "",
      truncated: false,
      error: session.error ?? "Could not read this PDF.",
    };
  }
  return {
    sessionId: session.sessionId,
    totalPages: session.totalPages,
    thumbUrl: thumbUrl(session.sessionId, 1),
    truncated: session.truncated,
  };
}

export function pageThumbFromSession(sessionId: string, pageNum: number, width?: number): string {
  return thumbUrl(sessionId, pageNum, width);
}

export function buildRangesEveryN(totalPages: number, every: number): { start: number; end: number }[] {
  const step = Math.max(1, every);
  const ranges: { start: number; end: number }[] = [];
  for (let start = 1; start <= totalPages; start += step) {
    ranges.push({ start, end: Math.min(start + step - 1, totalPages) });
  }
  return ranges;
}

export function rangesToFormString(ranges: { start: number; end: number }[]): string {
  return ranges.map((r) => `${r.start}-${r.end}`).join(",");
}

export function rangesFromSplitAfter(
  totalPages: number,
  splitAfter: Set<number>
): { start: number; end: number }[] {
  if (totalPages <= 0) return [];
  const cuts = Array.from(splitAfter)
    .filter((p) => p >= 1 && p < totalPages)
    .sort((a, b) => a - b);

  if (cuts.length === 0) {
    return [{ start: 1, end: totalPages }];
  }

  const ranges: { start: number; end: number }[] = [];
  let start = 1;
  for (const after of cuts) {
    ranges.push({ start, end: after });
    start = after + 1;
  }
  ranges.push({ start, end: totalPages });
  return ranges;
}

export function splitAfterFromEveryN(totalPages: number, every: number): Set<number> {
  const result = new Set<number>();
  const step = Math.max(1, every);
  for (let p = step; p < totalPages; p += step) {
    result.add(p);
  }
  return result;
}

export function splitAfterFromEachPage(totalPages: number): Set<number> {
  const result = new Set<number>();
  for (let p = 1; p < totalPages; p++) result.add(p);
  return result;
}
