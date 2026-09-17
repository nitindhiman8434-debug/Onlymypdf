import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    storage: {
      from: vi.fn(() => ({ list, remove })),
    },
  })),
}));

vi.mock("@/lib/pdf/pdf-session-store", () => ({
  PDF_SESSION_TTL_MS: 15 * 60 * 1000,
}));

vi.mock("@/lib/db/queries", () => ({
  getExpiredFiles: vi.fn(async () => []),
  markFileDeleted: vi.fn(),
  logError: vi.fn(async () => undefined),
  purgeOldConsentRecords: vi.fn(async () => 0),
  purgeOldUsageLogs: vi.fn(async () => 0),
  purgeOldAiUsageLogs: vi.fn(async () => 0),
  purgeOldErrorLogs: vi.fn(async () => 0),
}));

import { cleanupExpiredConversionJobs } from "./cleanup.service";

describe("conversion staging cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remove.mockResolvedValue({ error: null });
  });

  it("finds expired browser-direct uploads inside uploads/uuid/input.pdf", async () => {
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    list.mockImplementation(async (path: string) => {
      if (path === "temp-jobs/pdf-to-word") {
        return { data: [{ id: null, name: "uploads" }], error: null };
      }
      if (path === "temp-jobs/pdf-to-word/uploads") {
        return {
          data: [{ id: null, name: "123e4567-e89b-42d3-a456-426614174000" }],
          error: null,
        };
      }
      if (
        path ===
        "temp-jobs/pdf-to-word/uploads/123e4567-e89b-42d3-a456-426614174000"
      ) {
        return {
          data: [{ id: "object-id", name: "input.pdf", created_at: old }],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const result = await cleanupExpiredConversionJobs();

    expect(result).toEqual({ deleted: 1, failed: 0, scanned: 1 });
    expect(remove).toHaveBeenCalledWith([
      "temp-jobs/pdf-to-word/uploads/123e4567-e89b-42d3-a456-426614174000/input.pdf",
    ]);
  });
});
