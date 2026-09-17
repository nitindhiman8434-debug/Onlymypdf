import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/constants", () => ({
  APP_URL: "https://onlymypdf.test",
}));

vi.mock("@/lib/seo/routes", () => ({
  MARKETING_ROUTES: ["", "/pricing"],
  ALL_PUBLIC_TOOL_SLUGS: ["merge-pdf"],
}));

vi.mock("@/lib/seo/sitemap-dates", () => ({
  sitemapLastModifiedForMarketing: () => new Date("2026-07-01"),
  sitemapLastModifiedForTools: () => new Date("2026-07-01"),
  sitemapLastModifiedForAeo: () => new Date("2026-07-01"),
}));

describe("sitemap", () => {
  it("includes Hindi alternates for marketing and tool routes", async () => {
    const sitemap = (await import("@/app/sitemap")).default;
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain("https://onlymypdf.test/hi");
    expect(urls).toContain("https://onlymypdf.test/hi/pricing");
    expect(urls).toContain("https://onlymypdf.test/hi/merge-pdf");
  });
});
