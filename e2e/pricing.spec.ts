import { test, expect } from "@playwright/test";
import { gotoAndSettle } from "./helpers";

test.describe("Pricing", () => {
  test("pricing page shows Pro plan and OnlyMyPDF branding", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("OnlyMyPDF").first()).toBeVisible();
    await expect(page.getByText("$4.00").first()).toBeVisible();
    await expect(page.getByText("charged ₹299").first()).toBeVisible();
    await expect(page.getByText("Only4PDF")).toHaveCount(0);
  });

  test("dashboard pricing requires auth", async ({ page }) => {
    await page.goto("/dashboard/pricing");
    await expect(page).toHaveURL(/login/);
  });

  test("public pricing signup link targets dashboard pricing", async ({ page }) => {
    await page.goto("/pricing");
    const proLink = page.getByRole("link", { name: /Pro|Upgrade|Get Pro/i }).first();
    if (await proLink.isVisible()) {
      const href = await proLink.getAttribute("href");
      if (href?.includes("signup")) {
        expect(href).toContain("redirect=");
        expect(decodeURIComponent(href)).toContain("/dashboard/pricing");
      }
    }
  });

  test("pricing page includes Product JSON-LD", async ({ page }) => {
    await gotoAndSettle(page, "/pricing");
    const ld = page.locator('script[type="application/ld+json"]');
    await expect(ld.first()).toBeAttached();
    const entries = await ld.allTextContents();
    const product = entries.find((text) => text.includes('"@type":"Product"'));
    expect(product).toBeDefined();
    expect(product).toContain("2399");
  });
});
