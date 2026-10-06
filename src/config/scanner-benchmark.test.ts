import { describe, expect, it } from "vitest";
import report from "../../quality/phase3-scanner/first-report.json";
import { SCANNER_BENCHMARK, summarizeScannerBenchmark } from "./scanner-benchmark";

function clone() { return structuredClone(report); }

describe("retained Scanner benchmark publication", () => {
  it("separates five conversions, six rejections and fourteen rendered pages", () => {
    expect(SCANNER_BENCHMARK).toMatchObject({
      status: "passed", positivePassed: 5, positiveTotal: 5,
      negativePassed: 6, negativeTotal: 6, outputPages: 14, renderedPages: 14,
      measuredOnIso: "2026-10-06", measuredOn: "6 October 2026 (UTC)",
    });
    expect(SCANNER_BENCHMARK.cases.filter((item) => item.kind === "positive").map((item) => item.pageCount))
      .toEqual([1, 1, 1, 1, 10]);
    expect(SCANNER_BENCHMARK.cases.filter((item) => item.kind === "negative").every((item) => item.pageCount === 0)).toBe(true);
  });

  it("ignores optimistic aggregate fields and preserves missing-case denominators", () => {
    const changed = clone();
    changed.summary.passed = 999;
    changed.results.splice(0, 1);
    expect(summarizeScannerBenchmark(changed)).toMatchObject({ positivePassed: 4, positiveTotal: 5, outputPages: 13, status: "needs-review" });
  });

  it("does not count duplicate or unexpected measurements as clean evidence", () => {
    const changed = clone();
    changed.results.push(structuredClone(changed.results[0]));
    expect(summarizeScannerBenchmark(changed)).toMatchObject({ positivePassed: 4, status: "needs-review" });
    changed.results[changed.results.length - 1].caseId = "unregistered-case";
    expect(summarizeScannerBenchmark(changed)).toMatchObject({ positivePassed: 5, status: "needs-review" });
  });

  it("never treats generate-only or wrong-phase reports as measured", () => {
    for (const changed of [{ ...clone(), generateOnly: true }, { ...clone(), phase: "other" }]) {
      expect(summarizeScannerBenchmark(changed)).toMatchObject({ positivePassed: 0, negativePassed: 0, outputPages: 0, status: "needs-review" });
      expect(summarizeScannerBenchmark(changed).cases.every((item) => item.status === "not-tested")).toBe(true);
    }
  });

  it.each(["failed", "error", "not-tested", "success"])("does not publish the status %s as passed", (status) => {
    const changed = clone();
    changed.results[0].status = status;
    expect(summarizeScannerBenchmark(changed).positivePassed).toBe(4);
  });

  it("requires matching filter, input count, kind, MIME and HTTP response", () => {
    const variations = [
      { filter: "bw" }, { inputFiles: 2 }, { kind: "negative" },
      { contentType: "text/html" }, { httpStatus: 500 }, { outputBytes: 0 },
    ];
    for (const fields of variations) {
      const changed = clone();
      Object.assign(changed.results[0], fields);
      expect(summarizeScannerBenchmark(changed).positivePassed).toBe(4);
    }
  });

  it("requires complete ordered PDF pages with independently checked pixels", () => {
    const changed = clone();
    changed.results[4].validation!.pages.pop();
    expect(summarizeScannerBenchmark(changed)).toMatchObject({ positivePassed: 4, outputPages: 4 });
    const reordered = clone();
    reordered.results[4].validation!.pages.reverse();
    expect(summarizeScannerBenchmark(reordered).positivePassed).toBe(4);
    const failedPixel = clone();
    failedPixel.results[0].validation!.pages[0].pixelCheck.passed = false;
    expect(summarizeScannerBenchmark(failedPixel).positivePassed).toBe(4);
  });

  it("requires a matching source and complete unique render records", () => {
    const changed = clone();
    changed.sources.splice(0, 1);
    expect(summarizeScannerBenchmark(changed).positivePassed).toBe(4);
    const missingRender = clone();
    missingRender.results[4].renderedPreviewPaths!.pop();
    expect(summarizeScannerBenchmark(missingRender)).toMatchObject({ positivePassed: 4, renderedPages: 4 });
    const duplicateRender = clone();
    duplicateRender.results[4].renderedPreviewPaths![1] = duplicateRender.results[4].renderedPreviewPaths![0];
    expect(summarizeScannerBenchmark(duplicateRender).positivePassed).toBe(4);
  });

  it("does not claim A4 image-only output when page geometry or text disagrees", () => {
    const changed = clone();
    changed.results[0].validation!.pages[0].widthPoints = 612;
    changed.results[1].validation!.pages[0].selectableTextCharacters = 5;
    expect(summarizeScannerBenchmark(changed).positivePassed).toBe(3);
  });

  it("requires literal B&W levels and the stated threshold", () => {
    const changed = clone();
    const pixel = changed.results[1].validation!.pages[0].pixelCheck;
    if (!("threshold" in pixel)) throw new Error("Missing B&W fixture check");
    pixel.threshold = 129;
    expect(summarizeScannerBenchmark(changed).positivePassed).toBe(4);
  });

  it("only publishes Enhanced measurements with a real contrast increase and ordered patches", () => {
    expect(SCANNER_BENCHMARK.cases[2].checks.join(" ")).toContain("49 to 201");
    const changed = clone();
    const pixel = changed.results[2].validation!.pages[0].pixelCheck;
    if (!("outputP95P5Range" in pixel)) throw new Error("Missing Enhanced fixture check");
    pixel.outputP95P5Range = 10;
    const summary = summarizeScannerBenchmark(changed);
    expect(summary.positivePassed).toBe(4);
    expect(summary.cases[2].checks.join(" ")).not.toContain("49 to");
    const wrongOrder = clone();
    const patchCheck = wrongOrder.results[2].validation!.pages[0].pixelCheck;
    if (!("orderedPatchMeans" in patchCheck)) throw new Error("Missing Enhanced patch check");
    patchCheck.orderedPatchMeans.reverse();
    expect(summarizeScannerBenchmark(wrongOrder).positivePassed).toBe(4);
  });

  it("requires every invalid upload to return JSON 400 without a PDF", () => {
    const variations = [{ httpStatus: 200 }, { contentType: "application/pdf" }, { noPdfArtifact: false }, { outputBytes: 0 }];
    for (const fields of variations) {
      const changed = clone();
      Object.assign(changed.results[5], fields);
      expect(summarizeScannerBenchmark(changed)).toMatchObject({ negativePassed: 5, negativeTotal: 6, status: "needs-review" });
    }
  });

  it("uses the actual UTC measurement date, not the publication or manual-save date", () => {
    const changed = { ...clone(), generatedAt: "2026-10-07T03:37:47.736671+05:30" };
    expect(summarizeScannerBenchmark(changed).measuredOnIso).toBe("2026-10-06");
  });

  it.each([undefined, "today", "2026-10-07T00:00:00", "2026-02-30T00:00:00Z"])("rejects an invalid measurement date: %s", (generatedAt) => {
    expect(() => summarizeScannerBenchmark({ ...clone(), generatedAt })).toThrow();
  });

  it("publishes an allowlisted summary without private report fields or operator notes", () => {
    const serialized = JSON.stringify(SCANNER_BENCHMARK);
    expect(serialized).not.toMatch(/127\.0\.0\.1|localhost|tmp[\\/]pdfs|[A-Z]:[\\/]|sourcePath|outputPath|sha256|clicked on download|responseSha256/i);
    expect(SCANNER_BENCHMARK.limits.join(" ")).toContain("not a universal accuracy");
  });
});
