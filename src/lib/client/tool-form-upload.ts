/** POST multipart tool requests with upload + server-wait progress (no pipeline changes). */

import {
  parseToolApiErrorPayload,
  type ToolApiErrorPayload,
} from "@/lib/client/pdf-password-errors";

const UPLOAD_WEIGHT = 40;
const PROCESSING_CAP = 92;
const STALL_CAP = 99;
const TICK_MS = 450;
const STALL_TICK_MS = 1800;

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") {
    try {
      return await blob.text();
    } catch {
      // Fall back for test / legacy environments.
    }
  }
  const buffer = await blob.arrayBuffer();
  return new TextDecoder().decode(buffer);
}

async function parseErrorFromBlob(blob: Blob): Promise<never> {
  let text: string;
  try {
    text = await readBlobText(blob);
  } catch {
    throw new Error("Processing failed. Please try again.");
  }

  let data: ToolApiErrorPayload;
  try {
    data = JSON.parse(text) as ToolApiErrorPayload;
  } catch {
    throw new Error("Processing failed. Please try again.");
  }

  const passwordError = parseToolApiErrorPayload(data);
  if (passwordError) throw passwordError;
  throw new Error(data.error ?? "Processing failed. Please try again.");
}

export async function postToolFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<{ blob: Blob; getHeader: (name: string) => string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processingTimer: ReturnType<typeof setInterval> | null = null;
    let latestProgress = 0;

    const emit = (next: number) => {
      latestProgress = Math.min(100, Math.max(0, next));
      onProgress(latestProgress);
    };

    const stopProcessingTimer = () => {
      if (processingTimer) {
        clearInterval(processingTimer);
        processingTimer = null;
      }
    };

    const startProcessingTimer = () => {
      stopProcessingTimer();
      let stallTicks = 0;
      processingTimer = setInterval(() => {
        if (latestProgress >= STALL_CAP) return;
        if (latestProgress >= PROCESSING_CAP) {
          stallTicks += 1;
          // ~1.8s between ticks after the 92% cap so long jobs don't look frozen.
          if (stallTicks % Math.max(1, Math.round(STALL_TICK_MS / TICK_MS)) === 0) {
            emit(Math.min(STALL_CAP, latestProgress + 1));
          }
          return;
        }
        stallTicks = 0;
        const step = latestProgress < 60 ? 3 : latestProgress < 80 ? 2 : 1;
        emit(Math.min(PROCESSING_CAP, latestProgress + step));
      }, TICK_MS);
    };

    xhr.open("POST", url);
    xhr.responseType = "blob";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const uploadPct = Math.round((event.loaded / event.total) * UPLOAD_WEIGHT);
        emit(Math.min(UPLOAD_WEIGHT, uploadPct));
      }
    };

    xhr.upload.onloadend = () => {
      emit(Math.max(latestProgress, UPLOAD_WEIGHT));
      startProcessingTimer();
    };

    xhr.onload = () => {
      stopProcessingTimer();
      if (xhr.status >= 200 && xhr.status < 300) {
        emit(100);
        resolve({
          blob: xhr.response as Blob,
          getHeader: (name) => xhr.getResponseHeader(name),
        });
        return;
      }

      const failedBlob = xhr.response as Blob;
      void parseErrorFromBlob(failedBlob).catch((err) => {
        reject(err);
      });
    };

    xhr.onerror = () => {
      stopProcessingTimer();
      reject(new Error("Network error. Check your connection and try again."));
    };

    xhr.onabort = () => {
      stopProcessingTimer();
      reject(new Error("Upload cancelled."));
    };

    xhr.send(formData);
  });
}
