import { describe, expect, it } from "vitest";
import { buildPageMetadata, buildToolMetadata } from "@/lib/seo/metadata";

describe("buildPageMetadata", () => {
  it("includes English alternates without advertising a hidden Hindi page", () => {
    const meta = buildPageMetadata({
      title: "About",
      path: "/about",
    });

    const languages = meta.alternates?.languages;
    expect(languages).toBeDefined();
    expect(languages?.en).toContain("/about");
    expect(languages?.["x-default"]).toContain("/about");
    expect(languages).not.toHaveProperty("hi");
  });

  it("sets canonical via alternates", () => {
    const meta = buildPageMetadata({
      title: "Contact",
      path: "/contact",
    });
    expect(meta.alternates?.canonical).toContain("/contact");
  });
});

describe("buildToolMetadata", () => {
  it("generates metadata for merge-pdf slug", () => {
    const meta = buildToolMetadata("merge-pdf");
    expect(meta.title).toBeTruthy();
    expect(meta.alternates?.languages?.en).toContain("merge-pdf");
  });
});
