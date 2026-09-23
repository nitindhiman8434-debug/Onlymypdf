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
  { name: "rotate-pdf", path: "/rotate-pdf" },
  { name: "delete-pdf", path: "/delete-pdf" },
  { name: "extract-pdf", path: "/extract-pdf" },
  { name: "compress-pdf", path: "/compress-pdf" },
  { name: "pdf-to-word", path: "/pdf-to-word" },
  { name: "pdf-to-excel", path: "/pdf-to-excel" },
  { name: "pdf-to-ppt", path: "/pdf-to-ppt" },
  { name: "word-to-pdf", path: "/word-to-pdf" },
  { name: "excel-to-pdf", path: "/excel-to-pdf" },
  { name: "ppt-to-pdf", path: "/ppt-to-pdf" },
  { name: "jpg-to-pdf", path: "/jpg-to-pdf" },
  { name: "html-to-pdf", path: "/html-to-pdf" },
  { name: "txt-to-pdf", path: "/txt-to-pdf" },
  { name: "edit-pdf", path: "/edit-pdf" },
  { name: "sign-pdf", path: "/sign-pdf" },
  { name: "add-watermark", path: "/add-watermark" },
  { name: "ai-pdf-summarizer", path: "/ai-pdf-summarizer" },
  { name: "pdf-scanner", path: "/pdf-scanner" },
  { name: "unlock-pdf", path: "/unlock-pdf" },
  { name: "protect-pdf", path: "/protect-pdf" },
  { name: "repair-pdf", path: "/repair-pdf" },
  { name: "ocr-pdf", path: "/ocr-pdf" },
  { name: "pdf-a", path: "/pdf-a" },
  { name: "redact-pdf", path: "/redact-pdf" },
  { name: "crop-pdf", path: "/crop-pdf" },
  { name: "compare-pdf", path: "/compare-pdf" },
  { name: "pricing", path: "/pricing" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "privacy", path: "/privacy" },
  { name: "cookies", path: "/cookies" },
  { name: "trust", path: "/trust" },
  { name: "Hindi homepage", path: "/hi", lang: "hi" },
  { name: "Hindi merge-pdf", path: "/hi/merge-pdf", lang: "hi" },
  { name: "Hindi pricing", path: "/hi/pricing", lang: "hi" },
  { name: "Hindi privacy", path: "/hi/privacy", lang: "hi" },
] as const;

const MARKETING_CONTRAST_PAGES = [
  { name: "homepage", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "Hindi homepage", path: "/hi" },
  { name: "Hindi pricing", path: "/hi/pricing" },
  { name: "privacy", path: "/privacy" },
  { name: "cookies", path: "/cookies" },
  { name: "trust", path: "/trust" },
] as const;

const TOOL_CONTRAST_PAGES = [
  { name: "merge-pdf", path: "/merge-pdf" },
  { name: "split-pdf", path: "/split-pdf" },
  { name: "rotate-pdf", path: "/rotate-pdf" },
  { name: "delete-pdf", path: "/delete-pdf" },
  { name: "extract-pdf", path: "/extract-pdf" },
  { name: "compress-pdf", path: "/compress-pdf" },
  { name: "pdf-to-word", path: "/pdf-to-word" },
  { name: "pdf-to-excel", path: "/pdf-to-excel" },
  { name: "pdf-to-ppt", path: "/pdf-to-ppt" },
  { name: "word-to-pdf", path: "/word-to-pdf" },
  { name: "excel-to-pdf", path: "/excel-to-pdf" },
  { name: "ppt-to-pdf", path: "/ppt-to-pdf" },
  { name: "jpg-to-pdf", path: "/jpg-to-pdf" },
  { name: "html-to-pdf", path: "/html-to-pdf" },
  { name: "txt-to-pdf", path: "/txt-to-pdf" },
  { name: "edit-pdf", path: "/edit-pdf" },
  { name: "sign-pdf", path: "/sign-pdf" },
  { name: "add-watermark", path: "/add-watermark" },
  { name: "ai-pdf-summarizer", path: "/ai-pdf-summarizer" },
  { name: "pdf-scanner", path: "/pdf-scanner" },
  { name: "unlock-pdf", path: "/unlock-pdf" },
  { name: "protect-pdf", path: "/protect-pdf" },
  { name: "repair-pdf", path: "/repair-pdf" },
  { name: "ocr-pdf", path: "/ocr-pdf" },
  { name: "pdf-a", path: "/pdf-a" },
  { name: "redact-pdf", path: "/redact-pdf" },
  { name: "crop-pdf", path: "/crop-pdf" },
  { name: "compare-pdf", path: "/compare-pdf" },
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
