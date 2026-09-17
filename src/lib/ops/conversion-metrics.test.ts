import { describe, expect, it } from "vitest";
import { aggregateConversionMetrics, type ConversionMetricEvent } from "./conversion-metrics";

const at = "2026-09-17T00:00:00.000Z";

describe("aggregateConversionMetrics", () => {
  it("reports success, validation, fallback and latency percentiles", () => {
    const events: ConversionMetricEvent[] = [
      {
        toolName: "pdf-to-word",
        status: "completed",
        engine: "convertapi",
        queueTimeMs: 10,
        processingTimeMs: 100,
        attemptCount: 1,
        validation: {
          valid: true,
          kind: "docx",
          byteLength: 200,
          signatureValid: true,
          openable: true,
          errors: [],
          warnings: [],
          checkedAt: at,
        },
        occurredAt: at,
      },
      {
        toolName: "pdf-to-word",
        status: "completed",
        engine: "pdf2docx",
        queueTimeMs: 30,
        processingTimeMs: 300,
        attemptCount: 2,
        fallbackUsed: true,
        validation: {
          valid: true,
          kind: "docx",
          byteLength: 300,
          signatureValid: true,
          openable: true,
          errors: [],
          warnings: [],
          checkedAt: at,
        },
        occurredAt: "2026-09-17T00:01:00.000Z",
      },
      {
        toolName: "word-to-pdf",
        status: "failed",
        queueTimeMs: 20,
        processingTimeMs: 200,
        attemptCount: 1,
        occurredAt: "2026-09-17T00:02:00.000Z",
      },
    ];

    expect(aggregateConversionMetrics(events)).toMatchObject({
      jobs: 3,
      successful: 2,
      failed: 1,
      successRate: 66.67,
      validOutputRate: 100,
      fallbackRate: 33.33,
      queueP95Ms: 30,
      processingP50Ms: 200,
      processingP95Ms: 300,
      latestEventAt: "2026-09-17T00:02:00.000Z",
      byEngine: { convertapi: 1, pdf2docx: 1, unknown: 1 },
    });
  });

  it("does not invent percentages when there is no evidence", () => {
    expect(aggregateConversionMetrics([])).toMatchObject({
      jobs: 0,
      successRate: null,
      validOutputRate: null,
      fallbackRate: null,
      processingP95Ms: null,
    });
  });
});
