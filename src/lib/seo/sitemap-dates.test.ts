import { describe, expect, it } from "vitest";
import {
  sitemapLastModifiedForAeo,
  sitemapLastModifiedForMarketing,
  sitemapLastModifiedForTools,
} from "@/lib/seo/sitemap-dates";

describe("sitemapLastModified", () => {
  it("returns stable dates for marketing routes", () => {
    const home = sitemapLastModifiedForMarketing("");
    const contact = sitemapLastModifiedForMarketing("/contact");
    expect(home.getFullYear()).toBeGreaterThanOrEqual(2026);
    expect(contact.getTime()).toBeGreaterThan(0);
  });

  it("returns stable dates for tools and aeo", () => {
    expect(sitemapLastModifiedForTools().getFullYear()).toBeGreaterThanOrEqual(2026);
    expect(sitemapLastModifiedForAeo().getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("dates the English guide and updated machine-readable discovery content explicitly", () => {
    expect(sitemapLastModifiedForMarketing("/guides/scanned-pdf-to-word").toISOString())
      .toBe("2026-10-07T00:00:00.000Z");
    expect(sitemapLastModifiedForAeo().toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(sitemapLastModifiedForMarketing("/benchmarks").toISOString())
      .toBe("2026-10-07T00:00:00.000Z");
    expect(sitemapLastModifiedForTools().toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});
