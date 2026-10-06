import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { APP_URL } from "@/config/constants";
import { SCANNER_BENCHMARK } from "@/config/scanner-benchmark";
import { ScannerBenchmarkResults, scannerBenchmarkDataset } from "./scanner-results";
import BenchmarksPage, { metadata } from "./page";

vi.mock("@/components/layout/marketing-page-shell", () => ({
  MarketingPageShell: ({ children }: { children: ReactNode }) => createElement("main", null, children),
}));

function escapedText(value: string) {
  return renderToStaticMarkup(createElement("span", null, value)).slice(6, -7);
}

describe("Scanner benchmark publication", () => {
  it("separates five conversion cases from six rejection checks and fourteen output pages", () => {
    const html = renderToStaticMarkup(createElement(ScannerBenchmarkResults));
    expect(html).toContain('id="scanner-results"');
    expect(html).toContain('aria-labelledby="scanner-results-heading"');
    expect(html).toContain("Image-to-PDF conversion cases passed</dt>");
    expect(html).toContain("Invalid-input rejection checks passed</dt>");
    expect(html).toMatch(/<dd[^>]*>5\/5<\/dd>/);
    expect(html).toMatch(/<dd[^>]*>6\/6<\/dd>/);
    expect(html.match(/<dd[^>]*>14<\/dd>/g)).toHaveLength(2);
    expect(html).toContain("They are not additional successful conversions.");
    expect(html.match(/<article\b/g)).toHaveLength(11);
    expect(html.match(/Rejected as expected/g)).toHaveLength(6);
    for (const result of SCANNER_BENCHMARK.cases) {
      expect(html).toContain(`id="scanner-${result.id}"`);
      expect(html).toContain(`aria-labelledby="scanner-${result.id}-heading"`);
      expect(html).toContain(escapedText(result.title));
      for (const check of result.checks) expect(html).toContain(escapedText(check));
    }
  });

  it("shows the UTC measurement date, method, limits and working-route links", () => {
    const html = renderToStaticMarkup(createElement(ScannerBenchmarkResults));
    expect(html).toContain('dateTime="2026-10-06"');
    expect(html).toContain("6 October 2026 (UTC)");
    expect(html).not.toContain("7 October 2026");
    expect(html).toContain(escapedText(SCANNER_BENCHMARK.method));
    for (const limit of SCANNER_BENCHMARK.limits) expect(html).toContain(escapedText(limit));
    expect(html).toContain('href="/pdf-scanner"');
    expect(html).toContain('href="/guides/scanned-pdf-to-word"');
    expect(html).toContain("not establish searchable");
  });

  it("creates one Dataset from the same sanitized measurement with distinct counters", () => {
    const dataset = scannerBenchmarkDataset();
    expect(dataset["@type"]).toBe("Dataset");
    expect(dataset.url).toBe(`${APP_URL}/benchmarks#scanner-results`);
    expect(dataset["@id"]).toBe(dataset.url);
    expect(dataset.dateModified).toBe("2026-10-06");
    expect(dataset.measurementTechnique).toBe(SCANNER_BENCHMARK.method);
    expect(dataset.variableMeasured.map(({ name, value }) => [name, value])).toEqual([
      ["Passed image-to-PDF conversion cases", 5],
      ["Image-to-PDF conversion cases tested", 5],
      ["Passed invalid-input rejection checks", 6],
      ["Invalid-input rejection checks tested", 6],
      ["PDF output pages", 14],
      ["Independently rendered PDF pages", 14],
    ]);
    for (const limit of SCANNER_BENCHMARK.limits) expect(dataset.description).toContain(limit);
  });

  it("keeps failed and unverified cases visible without claiming their output pages passed", () => {
    const result: typeof SCANNER_BENCHMARK = {
      ...SCANNER_BENCHMARK,
      status: "needs-review",
      positivePassed: 3,
      outputPages: 12,
      renderedPages: 12,
      cases: SCANNER_BENCHMARK.cases.map((item, index) => ({
        ...item,
        status: index === 0 ? "failed" : index === 1 ? "not-tested" : item.status,
        pageCount: index < 2 ? 0 : item.pageCount,
      })),
    };
    const html = renderToStaticMarkup(createElement(ScannerBenchmarkResults, { result }));
    expect(html).toContain("This report needs review");
    expect(html).not.toContain("Recorded checks passed");
    expect(html).toContain("Failed check");
    expect(html).toContain("Not verified");
    expect(html.match(/Output pages not verified/g)).toHaveLength(2);
    expect(html).toMatch(/<dd[^>]*>3\/5<\/dd>/);
    expect(scannerBenchmarkDataset(result).description).toContain("This report needs review.");
    expect(scannerBenchmarkDataset(result).description).not.toContain("The recorded checks passed.");
  });

  it("connects the new section to page navigation and includes exactly one Scanner Dataset", () => {
    const html = renderToStaticMarkup(createElement(BenchmarksPage));
    const match = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const json = JSON.parse(match![1]) as Array<Record<string, unknown>>;
    const datasets = json.filter((item) => item["@type"] === "Dataset");
    expect(datasets).toHaveLength(6);
    expect(datasets.filter((item) => item["@id"] === `${APP_URL}/benchmarks#scanner-results`)).toHaveLength(1);
    expect(html).toContain('href="#scanner-results"');
    expect(html).toContain('id="scanner-results"');
    expect(metadata.description).toContain("English OCR and PDF Scanner");
  });

  it("keeps raw evidence files, machine paths and source image records out of public output", () => {
    const output = renderToStaticMarkup(createElement(ScannerBenchmarkResults)) + JSON.stringify(scannerBenchmarkDataset());
    expect(output).not.toMatch(/C:(?:\\|\/)|quality\/phase3-|first-report\.json|sourcePath|renderedPreviewPaths|outputPath|\.local-dev|127\.0\.0\.1/);
  });
});
