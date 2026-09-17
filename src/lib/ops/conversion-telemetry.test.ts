import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createServiceClient: vi.fn(),
}));

import {
  finishCleanupRun,
  getCleanupOperationalStatus,
  getConversionOperationalMetrics,
  recordConversionMetric,
  startCleanupRun,
} from "./conversion-telemetry";

describe("local operational telemetry", () => {
  it("records conversion validity and latency", async () => {
    await recordConversionMetric({
      toolName: "merge-pdf",
      status: "completed",
      engine: "pdf-lib",
      processingTimeMs: 25,
      attemptCount: 1,
      validation: {
        valid: true,
        kind: "pdf",
        byteLength: 100,
        signatureValid: true,
        openable: true,
        errors: [],
        warnings: [],
        checkedAt: new Date().toISOString(),
      },
      occurredAt: new Date().toISOString(),
    });
    const metrics = await getConversionOperationalMetrics(24);
    expect(metrics.jobs).toBeGreaterThanOrEqual(1);
    expect(metrics.validOutputRate).toBe(100);
  });

  it("records cleanup completion and deletion failures", async () => {
    const run = await startCleanupRun();
    await finishCleanupRun(run, {
      status: "failed",
      filesDeleted: 4,
      filesFailed: 1,
      tempSessionsDeleted: 2,
      tempSessionsFailed: 0,
      conversionJobsDeleted: 3,
      conversionJobsFailed: 0,
      errorCode: "PARTIAL_DELETE_FAILURE",
    });
    await expect(getCleanupOperationalStatus()).resolves.toMatchObject({
      status: "failed",
      filesDeleted: 4,
      filesFailed: 1,
      conversionJobsDeleted: 3,
      errorCode: "PARTIAL_DELETE_FAILURE",
    });
  });
});
