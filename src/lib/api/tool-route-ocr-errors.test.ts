import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createTestPdfFile } from "@/test/pdf-fixtures";
import { ConversionRuntimeUnavailableError, UnsupportedConversionInputError } from "@/lib/services/conversion-input-error";

vi.mock("@/lib/auth/tool-mutation-auth", () => ({
  resolveMutationToolUser: async () => ({ userId: null, denied: null }),
}));
vi.mock("@/lib/services/usage-limit.service", () => ({
  checkUsageLimit: async () => ({ allowed: true }),
}));
vi.mock("@/lib/services/user-tool-context.service", () => ({
  resolveToolUserContext: async () => ({ maxSizeMB: 25 }),
}));
vi.mock("@/lib/db/queries", () => ({
  logToolUsage: async () => undefined,
  logError: async () => undefined,
}));
vi.mock("@/lib/server/maintenance-mode", () => ({ isMaintenanceModeEnabled: async () => false }));
vi.mock("@/lib/server/rate-limiter", () => ({
  guardToolRateLimit: async () => null,
  guardApiKeyRateLimit: async () => null,
}));
vi.mock("@/lib/server/mutation-origin", () => ({ guardToolMutationOrigin: () => null }));
vi.mock("@/lib/server/client-ip", () => ({ getGuestUsageKey: () => "synthetic-guest" }));
vi.mock("@/lib/server/auth-guard-http", () => ({ authGuardResponse: () => null }));
vi.mock("@/lib/server/heavy-job-http", () => ({ heavyJobCapacityResponse: () => null }));
vi.mock("@/lib/services/conversion-completion.service", () => ({
  ConversionOutputValidationError: class extends Error {},
  recordFailedConversion: async () => undefined,
  validateAndRecordConversion: async () => undefined,
}));
import { createToolRoute } from "./tool-route";

describe("shared OCR tool route error statuses", () => {
  it.each([
    [new ConversionRuntimeUnavailableError("PDF OCR is temporarily unavailable. Please try again later."), 503],
    [new UnsupportedConversionInputError("PDF OCR could not recognize readable text on page 2. Try a clearer scan or supported language."), 422],
    [new Error("Unexpected internal OCR failure"), 500],
  ])("returns JSON with status %i for the actual failure class", async (error, status) => {
    const handler = createToolRoute({
      toolSlug: "ocr-pdf", allowedTypes: ["pdf"], contentType: "application/pdf", outputExtension: "pdf",
      convert: async () => { throw error; },
    });
    const body = new FormData();
    body.append("file", await createTestPdfFile("scan.pdf"));
    const response = await handler(new NextRequest("http://localhost/api/tools/ocr-pdf", { method: "POST", body }));
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBeNull();
    const payload = await response.json();
    if (error instanceof UnsupportedConversionInputError) expect(payload.error).toContain("page 2");
  });
});
