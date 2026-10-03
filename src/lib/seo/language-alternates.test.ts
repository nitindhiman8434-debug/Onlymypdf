import { describe, expect, it } from "vitest";
import { buildLanguageAlternates } from "@/lib/seo/language-alternates";

describe("buildLanguageAlternates", () => {
  it("builds English and default URLs without advertising retired Hindi pages", () => {
    const alt = buildLanguageAlternates("/pricing");
    expect(alt.canonical).toContain("/pricing");
    expect(alt.languages.en).toBe(alt.canonical);
    expect(alt.languages).not.toHaveProperty("hi");
    expect(alt.languages["x-default"]).toBe(alt.canonical);
  });

  it("uses canonical for home path", () => {
    const alt = buildLanguageAlternates("/");
    expect(alt.languages.en).toBe(alt.canonical);
    expect(alt.canonical).not.toMatch(/\/hi(?:\/|$)/);
  });

  it("strips /hi prefix from canonical when given Hindi path", () => {
    const alt = buildLanguageAlternates("/hi/terms");
    expect(alt.canonical).toContain("/terms");
    expect(alt.canonical).not.toContain("/hi");
    expect(alt.languages).not.toHaveProperty("hi");
  });

  it("excludes query and fragment values from the canonical URL", () => {
    const alt = buildLanguageAlternates("/hi/pdf-to-word?lang=hi#upload");
    expect(new URL(alt.canonical).pathname).toBe("/pdf-to-word");
    expect(new URL(alt.canonical).search).toBe("");
    expect(new URL(alt.canonical).hash).toBe("");
  });
});
