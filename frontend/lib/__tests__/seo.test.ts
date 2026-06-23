import { describe, it, expect } from "vitest";
import { alternates, toolJsonLd } from "@/lib/seo";
import { TOOLS, getTool } from "@/lib/tools";

describe("SEO metadata", () => {
  it("builds canonical + en/hi/x-default hreflang alternates", () => {
    const a = alternates("/compress-pdf");
    expect(a.canonical).toContain("/compress-pdf");
    expect(a.languages.hi).toContain("/hi/compress-pdf");
    expect(a.languages["x-default"]).toBeDefined();
  });

  it("emits SoftwareApplication + BreadcrumbList + FAQPage JSON-LD", () => {
    const tool = getTool("pdf-to-word")!;
    const ld = toolJsonLd(tool, "en", [{ q: "Q", a: "A" }]);
    const types = ld["@graph"].map((g: any) => g["@type"]);
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
  });
});

describe("Tool registry", () => {
  it("has unique slugs", () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("flags High Accuracy Beta on the key conversion tools", () => {
    for (const code of ["pdf-to-word", "pdf-to-excel", "pdf-ocr", "translate-pdf"]) {
      expect(getTool(code)?.highAccuracy).toBe(true);
    }
  });

  it("keeps ask-pdf disabled at launch (feature flag)", () => {
    expect(TOOLS.find((t) => t.code === "ask-pdf")?.enabled).toBe(false);
  });
});
