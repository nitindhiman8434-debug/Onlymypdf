import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OCR_BENCHMARKS } from "@/config/ocr-benchmark";
import { CONVERSION_BENCHMARK } from "@/config/conversion-benchmark";
import { APP_URL } from "@/config/constants";
import { sitemapLastModifiedForMarketing } from "@/lib/seo/sitemap-dates";
import { OcrBenchmarkResults, ocrBenchmarkDatasets } from "./ocr-results";
import BenchmarksPage, { metadata } from "./page";

// The shell's client-only design context is unrelated to the server evidence.
vi.mock("@/components/layout/marketing-page-shell", () => ({
  MarketingPageShell: ({ children }: { children: ReactNode }) => createElement("main", null, children),
}));

describe("English OCR benchmark publication", () => {
  it("renders every report as an addressable section with dated checks and limits", () => {
    const html = renderToStaticMarkup(createElement(OcrBenchmarkResults));
    expect(html.match(/<article\b/g)).toHaveLength(4);
    for (const result of OCR_BENCHMARKS) {
      expect(html).toContain(`id="ocr-${result.id}"`);
      expect(html).toContain(`aria-labelledby="ocr-${result.id}-heading"`);
      expect(html).toContain(`dateTime="${result.measuredOnIso}"`);
      expect(html).toContain(result.measuredOn);
      expect(html).toContain(`${result.passed}/${result.total} fixture checks passed`);
      expect(html).toContain(`href="${result.toolHref}"`);
    }
    expect(html.match(/Limits of this result/g)).toHaveLength(4);
    expect(html).toContain("not an accuracy percentage");
    expect(html).toContain("not by customers");
  });

  it("keeps structured results tied to the same dates, counts, scope and visible anchors", () => {
    const datasets = ocrBenchmarkDatasets();
    expect(datasets).toHaveLength(OCR_BENCHMARKS.length);
    for (const [index, dataset] of datasets.entries()) {
      const evidence = OCR_BENCHMARKS[index];
      expect(dataset["@type"]).toBe("Dataset");
      expect(dataset.url).toBe(`${APP_URL}/benchmarks#ocr-${evidence.id}`);
      expect(dataset["@id"]).toBe(dataset.url);
      expect(dataset.dateModified).toBe(evidence.measuredOnIso);
      expect(dataset.description).toContain(evidence.summary);
      for (const limit of evidence.limits) expect(dataset.description).toContain(limit);
      expect(dataset.variableMeasured.map((value) => value.value)).toEqual([evidence.passed, evidence.total]);
    }
  });

  it("publishes five valid datasets while preserving the original dated baseline and OCR stub disclosure", () => {
    const html = renderToStaticMarkup(createElement(BenchmarksPage));
    const match = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const json = JSON.parse(match![1]) as Array<Record<string, unknown>>;
    const datasets = json.filter((item) => item["@type"] === "Dataset");
    expect(datasets).toHaveLength(5);
    expect(datasets[0].dateModified).toBe(CONVERSION_BENCHMARK.measuredOnIso);
    expect(datasets[0].description).toContain("stub");
    expect(new Set(datasets.map((item) => item["@id"])).size).toBe(5);
    expect(html).toContain("does not measure Tesseract recognition accuracy");
    expect(html).toContain('href="#ocr-results"');
    expect(html).toContain('id="document-corpus"');
    const faq = json.find((item) => item["@type"] === "FAQPage");
    expect(JSON.stringify(faq)).toContain("Were scanned PDFs and editable Word tables tested?");
  });

  it("does not expose raw report files or machine paths in page output or metadata", () => {
    const output = renderToStaticMarkup(createElement(BenchmarksPage));
    expect(output).not.toMatch(/C:(?:\\|\/)|sourceSha256|outputDocxPath|sourcePreviewPaths|tmp\/pdfs|quality\/phase3-/);
  });

  it("updates the English page discovery date without rewriting historical measurements", () => {
    expect(metadata.description).toContain("English OCR");
    expect(sitemapLastModifiedForMarketing("/benchmarks").toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(CONVERSION_BENCHMARK.measuredOnIso).toBe("2026-10-03");
  });
});
