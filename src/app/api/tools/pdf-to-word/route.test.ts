import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfToWordOcrError } from "@/lib/services/pdf-to-word-ocr-error";
import { ConversionRuntimeUnavailableError } from "@/lib/services/conversion-input-error";

const convert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/pdf-to-word.service", async (original) => ({
  ...await original<typeof import("@/lib/services/pdf-to-word.service")>(),
  pdfToWord: convert,
}));
vi.mock("@/lib/services/pdf-to-word-jobs.service", () => ({}));
vi.mock("@/lib/services/pdf-to-word-worker.service", () => ({}));
vi.mock("@/lib/server/direct-upload-grant", () => ({}));
vi.mock("@/lib/server/upstash-kv", () => ({}));
vi.mock("@/lib/server/job-payload-secret", () => ({}));
vi.mock("@/lib/server/job-owner", () => ({}));
vi.mock("@/lib/services/usage-limit.service", () => ({
  checkUsageLimit: async () => ({ allowed: true }),
}));
vi.mock("@/lib/services/user-tool-context.service", () => ({
  resolveToolUserContext: async () => ({ maxSizeMB: 25 }),
}));
vi.mock("@/lib/db/queries", () => ({
  logToolUsage: vi.fn(async () => undefined),
  logError: vi.fn(async () => undefined),
}));
vi.mock("@/lib/auth/tool-mutation-auth", () => ({
  resolveMutationToolUser: async () => ({ userId: null, denied: null }),
}));
vi.mock("@/lib/server/tool-request-guards", () => ({ guardMaintenanceMode: async () => null }));
vi.mock("@/lib/server/rate-limiter", () => ({
  guardToolRateLimit: async () => null,
  guardApiKeyRateLimit: async () => null,
}));
vi.mock("@/lib/server/mutation-origin", () => ({ guardToolMutationOrigin: () => null }));
vi.mock("@/lib/server/user-blocked-http", () => ({ userBlockedResponse: () => null }));
vi.mock("@/lib/server/heavy-job-http", () => ({ heavyJobCapacityResponse: () => null }));
vi.mock("@/lib/server/conversion-semaphore", () => ({
  withHeavyJobGuard: async (convert: () => Promise<unknown>) => convert(),
}));
vi.mock("@/lib/server/upload-validation", () => ({
  validateSingleUpload: async () => ({ ok: true, buffer: Buffer.from("validated PDF") }),
}));
vi.mock("@/lib/pdf/pdf-password.server", () => ({
  resolvePdfBuffer: async (buffer: Buffer) => buffer,
}));
vi.mock("@/lib/services/conversion-completion.service", () => ({
  ConversionOutputValidationError: class extends Error {},
  recordFailedConversion: vi.fn(async () => undefined),
  validateAndRecordConversion: vi.fn(async () => undefined),
}));

import { POST } from "./route";

function request(): NextRequest {
  const body = new FormData();
  body.append("file", new File(["PDF"], "scan.pdf", { type: "application/pdf" }));
  return new NextRequest("http://localhost/api/tools/pdf-to-word", { method: "POST", body });
}

describe("synchronous PDF-to-Word OCR error responses", () => {
  beforeEach(() => {
    convert.mockReset();
  });

  it.each([422, 503] as const)("uses classified OCR status %i without returning a document", async (status) => {
    convert.mockRejectedValue(new PdfToWordOcrError("Specific OCR failure", status));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toMatchObject({ error: "Specific OCR failure" });
  });

  it("keeps unexpected converter failures as server errors", async () => {
    convert.mockRejectedValue(new Error("Unexpected internal failure"));
    const response = await POST(request());
    expect(response.status).toBe(500);
  });

  it("reports a missing pinned Python runtime as service unavailable", async () => {
    convert.mockRejectedValue(new ConversionRuntimeUnavailableError("PDF to Word processing is temporarily unavailable."));
    expect((await POST(request())).status).toBe(503);
  });

  it.each(["PASSWORD_REQUIRED", "WRONG_PASSWORD"])("preserves password classification: %s", async (message) => {
    convert.mockRejectedValue(new Error(message));
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/password/i);
  });
});
