import { describe, expect, it } from "vitest";
import { MARKETING_ROUTES } from "@/lib/seo/routes";
import { APP_URL } from "@/config/constants";
import sitemap from "@/app/sitemap";

describe("MARKETING_ROUTES", () => {
  it("includes legal and trust pages for sitemap", () => {
    expect(MARKETING_ROUTES).toEqual(
      expect.arrayContaining(["/refund", "/trust", "/sla", "/benchmarks"])
    );
  });

  it("publishes one English guide URL without an invented guides index", () => {
    const guideRoutes = MARKETING_ROUTES.filter((path) => path.startsWith("/guides"));
    expect(guideRoutes).toEqual(["/guides/scanned-pdf-to-word"]);
    const guideEntries = sitemap().filter((entry) => entry.url.includes("/guides"));
    expect(guideEntries).toHaveLength(1);
    expect(guideEntries[0]).toMatchObject({
      url: `${APP_URL}/guides/scanned-pdf-to-word`,
      lastModified: new Date("2026-10-07T00:00:00Z"),
    });
  });

  it("retains the existing public marketing routes", () => {
    expect(MARKETING_ROUTES.filter((path) => !path.startsWith("/guides"))).toEqual([
      "", "/all-tools", "/about", "/faq", "/contact", "/pricing", "/convert",
      "/privacy", "/cookies", "/terms", "/refund", "/trust", "/sla", "/status", "/benchmarks",
    ]);
  });
});
