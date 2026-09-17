import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoAndSettle } from "./helpers";

async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  expect(serious).toEqual([]);
}

async function expectNoColorContrastViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();

  const contrast = results.violations.filter(
    (v) =>
      v.id === "color-contrast" &&
      (v.impact === "moderate" || v.impact === "serious" || v.impact === "critical")
  );
  expect(contrast).toEqual([]);
}

const AXE_PAGES = [
  { name: "homepage", path: "/" },
  { name: "merge-pdf", path: "/merge-pdf" },
  { name: "split-pdf", path: "/split-pdf" },
  { name: "compress-pdf", path: "/compress-pdf" },
  { name: "pdf-to-word", path: "/pdf-to-word" },
  { name: "pricing", path: "/pricing" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "Hindi homepage", path: "/hi", lang: "hi" },
  { name: "Hindi merge-pdf", path: "/hi/merge-pdf", lang: "hi" },
  { name: "Hindi pricing", path: "/hi/pricing", lang: "hi" },
] as const;

const MARKETING_CONTRAST_PAGES = [
  { name: "homepage", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "Hindi homepage", path: "/hi" },
  { name: "Hindi pricing", path: "/hi/pricing" },
] as const;

const TOOL_CONTRAST_PAGES = [
  { name: "merge-pdf", path: "/merge-pdf" },
  { name: "split-pdf", path: "/split-pdf" },
  { name: "compress-pdf", path: "/compress-pdf" },
  { name: "pdf-to-word", path: "/pdf-to-word" },
  { name: "Hindi merge-pdf", path: "/hi/merge-pdf" },
  { name: "Hindi compress-pdf", path: "/hi/compress-pdf" },
] as const;

test.describe("Accessibility smoke", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const entry of AXE_PAGES) {
    test(`${entry.name} has no serious axe violations`, async ({ page }) => {
      await gotoAndSettle(page, entry.path);

      if ("lang" in entry && entry.lang) {
        const lang = await page.locator("html").getAttribute("lang");
        expect(lang).toBe(entry.lang);
      }

      await expectNoSeriousViolations(page);
    });
  }
});

test.describe("Marketing color contrast", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const entry of MARKETING_CONTRAST_PAGES) {
    test(`${entry.name} has no moderate+ color-contrast violations`, async ({ page }) => {
      await gotoAndSettle(page, entry.path);
      await expectNoColorContrastViolations(page);
    });
  }
});

test.describe("Tool page color contrast", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const entry of TOOL_CONTRAST_PAGES) {
    test(`${entry.name} has no moderate+ color-contrast violations`, async ({ page }) => {
      await gotoAndSettle(page, entry.path);
      await expectNoColorContrastViolations(page);
    });
  }
});
