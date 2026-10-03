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
  it("includes each English page once and omits retired Hindi URLs", async () => {
    const sitemap = (await import("@/app/sitemap")).default;
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toEqual([
      "https://onlymypdf.test",
      "https://onlymypdf.test/pricing",
      "https://onlymypdf.test/merge-pdf",
      "https://onlymypdf.test/llms.txt",
      "https://onlymypdf.test/ai.txt",
    ]);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.some((url) => new URL(url).pathname.startsWith("/hi"))).toBe(false);
  });
});
