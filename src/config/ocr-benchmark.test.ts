import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import wordReport from "../../quality/phase3-english-word/latest-report.json";
import geometryReport from "../../quality/phase3-ocr-geometry/final.json";
import tableReport from "../../quality/phase3-english-table/final-strict-report.json";
import multiTableReport from "../../quality/phase3-english-multitable/final-report.json";
import tableVisual from "../../quality/phase3-english-table/visual-review-final-strict.json";
import multiTableVisual from "../../quality/phase3-english-multitable/visual-review.json";
import {
  OCR_BENCHMARKS, OCR_BENCHMARK_LATEST_DATE_ISO,
  OCR_GEOMETRY_INDEPENDENT_PAGES, ocrBenchmarkDate, summarizeOcrBenchmark,
  type OcrBenchmarkKind,
} from "./ocr-benchmark";

const reports = [
  { id: "english-word", report: wordReport, kind: "word" as const, passed: 4, date: "2026-10-03" },
  { id: "ocr-page-geometry", report: geometryReport, kind: "geometry" as const, passed: 5, date: "2026-10-03" },
  { id: "single-ruled-table", report: tableReport, kind: "ruled-table" as const, passed: 4, date: "2026-10-06" },
  { id: "two-ruled-tables", report: multiTableReport, kind: "ruled-table" as const, passed: 4, date: "2026-10-06" },
];

type MutableReport = {
  generatedAt: string;
  generateOnly?: boolean;
  mode?: string;
  summary?: unknown;
  cases: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
};

function clone(report: unknown): MutableReport {
  return structuredClone(report) as MutableReport;
}

function measurements(report: MutableReport, kind: OcrBenchmarkKind) {
  return kind === "geometry" ? report.cases : report.results!;
}

describe("report-backed English OCR benchmark data", () => {
  it.each(reports)("derives $id counts and UTC date from retained measurements", ({ id, report, kind, passed, date }) => {
    const summary = summarizeOcrBenchmark(report, kind);
    expect(summary).toMatchObject({ passed, total: passed, status: "passed", measuredOnIso: date });
    expect(summary.counts).toEqual({ passed, failed: 0, error: 0, "not-tested": 0 });
    expect(OCR_BENCHMARKS.find((entry) => entry.id === id)).toMatchObject(summary);
  });

  it.each(reports)("ignores stale summary pass counts for $id", ({ report, kind, passed }) => {
    const changed = clone(report);
    changed.summary = { passed: 999, allPassed: true };
    measurements(changed, kind)[0].status = "failed";
    expect(summarizeOcrBenchmark(changed, kind).counts).toEqual({
      passed: passed - 1, failed: 1, error: 0, "not-tested": 0,
    });
  });

  it.each(["failed", "error", "not-tested", "success", undefined])("never treats %s as a passing measurement", (status) => {
    const changed = clone(multiTableReport);
    changed.results![0].status = status;
    const summary = summarizeOcrBenchmark(changed, "ruled-table");
    expect(summary.passed).toBe(3);
    expect(summary.status).toBe("needs-review");
    expect(summary.counts[status === "failed" || status === "error" ? status : "not-tested"]).toBe(1);
  });

  it("retains missing fixtures in the denominator and rejects duplicate results", () => {
    const changed = clone(tableReport);
    changed.results!.pop();
    expect(summarizeOcrBenchmark(changed, "ruled-table")).toMatchObject({ passed: 3, total: 4 });
    expect(summarizeOcrBenchmark(changed, "ruled-table").counts["not-tested"]).toBe(1);
    changed.results!.push(structuredClone(changed.results![0]));
    expect(summarizeOcrBenchmark(changed, "ruled-table").counts.error).toBe(1);
  });

  it("does not reuse a measurement for another fixture or route", () => {
    const changed = clone(wordReport);
    changed.results![0].caseId = "unrelated";
    changed.results![1].tool = "pdf-to-excel";
    expect(summarizeOcrBenchmark(changed, "word").counts).toEqual({
      passed: 2, failed: 1, error: 0, "not-tested": 1,
    });
  });

  it.each(reports)("does not publish generate-only $id evidence as measured", ({ report, kind }) => {
    const changed = clone(report);
    if (kind === "geometry") changed.mode = "generate-only";
    else changed.generateOnly = true;
    expect(summarizeOcrBenchmark(changed, kind).passed).toBe(0);
  });

  it.each(reports)("requires valid source artifacts for $id", ({ report, kind, passed }) => {
    const changed = clone(report);
    if (kind === "geometry") changed.cases[0].fixture = { literalSourceTextValidated: false };
    else changed.cases[0].source = { passed: false };
    expect(summarizeOcrBenchmark(changed, kind)).toMatchObject({ passed: passed - 1, status: "needs-review" });
  });

  it.each(["httpStatus", "outputBytes", "document", "rendered"])("requires actual successful %s evidence, not only a pass label", (field) => {
    const changed = clone(tableReport);
    delete changed.results![0][field];
    expect(summarizeOcrBenchmark(changed, "ruled-table").passed).toBe(3);
  });

  it("requires native table checks for table claims and honors failed child gates", () => {
    const changed = structuredClone(multiTableReport);
    changed.results[0].document.nativeTables.passed = false;
    expect(summarizeOcrBenchmark(changed, "ruled-table").passed).toBe(3);
    changed.results[0].document.nativeTables.passed = true;
    changed.results[0].document.content.numericValues[0].passed = false;
    expect(summarizeOcrBenchmark(changed, "ruled-table").passed).toBe(3);
  });

  it("requires PDF geometry validation and does not ignore a failing page", () => {
    const changed = structuredClone(geometryReport);
    changed.cases[0].validation.passed = false;
    expect(summarizeOcrBenchmark(changed, "geometry").passed).toBe(4);
    changed.cases[0].validation.passed = true;
    changed.cases[0].validation.pages[0].passed = false;
    expect(summarizeOcrBenchmark(changed, "geometry").passed).toBe(4);
  });

  it("rejects duplicate fixture IDs and never makes an empty report a pass", () => {
    const changed = clone(wordReport);
    changed.cases.push(structuredClone(changed.cases[0]));
    expect(() => summarizeOcrBenchmark(changed, "word")).toThrow("duplicate fixture IDs");
    expect(summarizeOcrBenchmark({ generatedAt: wordReport.generatedAt, cases: [] }, "word"))
      .toMatchObject({ passed: 0, total: 0, status: "needs-review" });
  });

  it("keeps dates deterministic across offsets and compact microsecond timestamps", () => {
    expect(ocrBenchmarkDate("2026-10-07T02:29:05.918080+05:30")).toEqual({
      measuredOnIso: "2026-10-06", measuredOn: "6 October 2026 (UTC)",
    });
    expect(ocrBenchmarkDate("20261003T034329547112Z")).toEqual({
      measuredOnIso: "2026-10-03", measuredOn: "3 October 2026 (UTC)",
    });
    expect(OCR_BENCHMARK_LATEST_DATE_ISO).toBe("2026-10-06");
  });

  it.each([undefined, "", "today", "2026-10-07T02:29:05", "2026-02-30T00:00:00Z"])("rejects invalid or timezone-free dates: %s", (date) => {
    expect(() => ocrBenchmarkDate(date)).toThrow();
  });

  it("exports bounded safe summaries without source documents, paths or service details", () => {
    const serialized = JSON.stringify(OCR_BENCHMARKS);
    expect(serialized).not.toMatch(/127\.0\.0\.1|localhost|[A-Z]:[\\/]|tmp[\\/]pdfs|outputPath|sourcePath|api[_-]?key|responseSha256/i);
    expect(serialized).not.toContain("Planning invoice 004218");
    for (const benchmark of OCR_BENCHMARKS) {
      expect(["/ocr-pdf", "/pdf-to-word"]).toContain(benchmark.toolHref);
      expect(benchmark.checks.length).toBeGreaterThan(0);
      expect(benchmark.limits.length).toBeGreaterThan(0);
    }
    expect(OCR_BENCHMARKS.map((entry) => entry.phase)).toEqual(["3.2D", "3.2E", "3.2F", "3.2G"]);
  });

  it("binds separately reviewed pages to the exact conversion reports", () => {
    const sha256 = (path: string) => createHash("sha256")
      .update(readFileSync(resolve(process.cwd(), path))).digest("hex");
    expect(tableVisual.currentConversionReport.sha256)
      .toBe(sha256("quality/phase3-english-table/final-strict-report.json"));
    expect(tableVisual.originalVisualReview.sha256)
      .toBe(sha256("quality/phase3-english-table/visual-review.json"));
    expect(multiTableVisual.reports.final.sha256)
      .toBe(sha256("quality/phase3-english-multitable/final-report.json"));
    expect(tableVisual.pages).toHaveLength(5);
    expect(tableVisual.pages.every((page) => page.decodedPixelBytesIdentical === true)).toBe(true);
    expect(multiTableVisual.cases.map((entry) => entry.caseId).sort())
      .toEqual(multiTableReport.cases.map((entry) => entry.caseId).sort());
    expect(multiTableVisual.cases.every((entry) => entry.status === "passed")).toBe(true);
    expect(OCR_BENCHMARKS.find((entry) => entry.id === "single-ruled-table")?.visualPages).toBe(5);
    expect(OCR_BENCHMARKS.find((entry) => entry.id === "two-ruled-tables")?.visualPages).toBe(4);
    expect(OCR_GEOMETRY_INDEPENDENT_PAGES).toBe(7);
    expect(geometryReport.cases.reduce((total, entry) => total + entry.validation.actualPageCount, 0)).toBe(7);
  });
});
