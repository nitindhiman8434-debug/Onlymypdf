import { describe, expect, it } from "vitest";
import { MARKETING_ROUTES } from "@/lib/seo/routes";

describe("MARKETING_ROUTES", () => {
  it("includes legal and trust pages for sitemap", () => {
    expect(MARKETING_ROUTES).toEqual(
      expect.arrayContaining(["/refund", "/trust", "/sla", "/benchmarks"])
    );
  });
});
