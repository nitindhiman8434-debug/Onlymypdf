import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { APP_URL } from "@/config/constants";
import { OCR_BENCHMARKS } from "@/config/ocr-benchmark";
import { SCANNED_PDF_GUIDE as GUIDE, scannedPdfGuideArticle } from "@/config/scanned-pdf-guide";
import ScannedPdfGuidePage, { metadata } from "./page";

vi.mock("@/components/layout/marketing-page-shell", () => ({
  MarketingPageShell: ({ children, title }: { children: ReactNode; title: string }) =>
    createElement("main", null, createElement("h1", null, title), children),
}));

describe("scanned PDF guide", () => {
  it("keeps canonical, article identity, visible publication date and breadcrumb aligned", () => {
    const html = renderToStaticMarkup(createElement(ScannedPdfGuidePage));
    const article = scannedPdfGuideArticle();
    expect(metadata.alternates?.canonical).toBe(`${APP_URL}${GUIDE.path}`);
    expect(article.url).toBe(metadata.alternates?.canonical);
    expect(article.headline).toBe(GUIDE.title);
    expect(html).toContain(`<h1>${GUIDE.title}</h1>`);
    expect(article.datePublished).toBe(article.dateModified);
    expect(html).toContain(`dateTime="${article.datePublished}"`);
    expect(article.inLanguage).toBe("en");
    expect(article.author["@type"]).toBe("Organization");
    const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    const schemas = scripts.flatMap((match) => JSON.parse(match[1]));
    expect(schemas.find((item) => item["@type"] === "Article")).toEqual(article);
    const crumbs = schemas.find((item) => item["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((item: { item: string }) => item.item))
      .toEqual([APP_URL, `${APP_URL}${GUIDE.path}`]);
  });

  it("publishes the visible questions and answers exactly once in the FAQ schema", () => {
    const html = renderToStaticMarkup(createElement(ScannedPdfGuidePage));
    const match = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    const schemas = JSON.parse(match![1]);
    const faq = schemas.find((item: Record<string, unknown>) => item["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(GUIDE.faqs.length);
    for (const [index, question] of GUIDE.faqs.entries()) {
      expect(faq.mainEntity[index].name).toBe(question.question);
      expect(faq.mainEntity[index].acceptedAnswer.text).toBe(question.answer);
      expect(html).toContain(question.question);
    }
  });

  it("offers only existing destination routes and valid local section anchors", () => {
    const html = renderToStaticMarkup(createElement(ScannedPdfGuidePage));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    const hrefs = [...html.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const href of hrefs.filter((value) => value.startsWith("#"))) expect(ids).toContain(href.slice(1));
    expect(hrefs).toEqual(expect.arrayContaining(["/pdf-to-word", "/ocr-pdf", "/pdf-scanner", "/benchmarks#ocr-results", GUIDE.sourceUrl]));
    expect(hrefs).not.toContain("/guides");
    expect(hrefs.some((href) => href.startsWith("/hi/"))).toBe(false);
  });

  it("uses measured table counts and dates without exposing raw evidence objects", () => {
    const html = renderToStaticMarkup(createElement(ScannedPdfGuidePage));
    const tableResults = OCR_BENCHMARKS.filter((result) => ["single-ruled-table", "two-ruled-tables"].includes(result.id));
    expect(tableResults).toHaveLength(2);
    for (const result of tableResults) {
      expect(html).toContain(`${result.passed}/${result.total} controlled cases passed`);
      expect(html).toContain(result.measuredOn);
      expect(html).toContain(`/benchmarks#ocr-${result.id}`);
    }
    expect(html).not.toMatch(/sourceSha256|outputDocxPath|sourcePreviewPaths|quality\/phase3-|C:[\\/]/);
  });
});
