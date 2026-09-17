import { describe, expect, it, vi } from "vitest";
import { postToolFormDataWithProgress } from "./tool-form-upload";

describe("postToolFormDataWithProgress", () => {
  it("rejects with server JSON error message on non-2xx responses", async () => {
    const formData = new FormData();
    formData.append("file", new File(["%PDF"], "big.pdf", { type: "application/pdf" }));

    const errorPayload = JSON.stringify({
      error: "File size (46.1 MB) exceeds the maximum allowed size of 25 MB.",
    });

    class MockXHR {
      upload = { onprogress: null as ((e: ProgressEvent) => void) | null, onloadend: null as (() => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      responseType = "";
      status = 400;
      response = {
        text: async () => errorPayload,
        arrayBuffer: async () => new TextEncoder().encode(errorPayload).buffer,
      } as unknown as Blob;

      open() {}
      send() {
        this.upload.onloadend?.();
        this.onload?.();
      }
      getResponseHeader() {
        return null;
      }
    }

    vi.stubGlobal("XMLHttpRequest", MockXHR as unknown as typeof XMLHttpRequest);

    const progress: number[] = [];
    await expect(
      postToolFormDataWithProgress("/api/tools/compress-pdf", formData, (pct) => {
        progress.push(pct);
      })
    ).rejects.toThrow("File size (46.1 MB) exceeds the maximum allowed size of 25 MB.");

    vi.unstubAllGlobals();
  });

  it("rejects with password error when server returns password_required", async () => {
    const formData = new FormData();
    formData.append("file", new File(["%PDF"], "locked.pdf", { type: "application/pdf" }));

    const errorPayload = JSON.stringify({
      error: "This PDF is password-protected. Enter the password to compress.",
      code: "password_required",
      fileName: "locked.pdf",
    });

    class MockXHR {
      upload = { onprogress: null as ((e: ProgressEvent) => void) | null, onloadend: null as (() => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      responseType = "";
      status = 400;
      response = {
        text: async () => errorPayload,
        arrayBuffer: async () => new TextEncoder().encode(errorPayload).buffer,
      } as unknown as Blob;

      open() {}
      send() {
        this.upload.onloadend?.();
        this.onload?.();
      }
      getResponseHeader() {
        return null;
      }
    }

    vi.stubGlobal("XMLHttpRequest", MockXHR as unknown as typeof XMLHttpRequest);

    await expect(
      postToolFormDataWithProgress("/api/tools/compress-pdf", formData, () => {})
    ).rejects.toMatchObject({
      name: "ToolApiPasswordError",
      code: "password_required",
      fileName: "locked.pdf",
    });

    vi.unstubAllGlobals();
  });
});
