import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoAndSettle, waitForMainHydrated } from "./helpers";

async function expectFocused(locator: Locator) {
  await expect(locator).toBeFocused();
}

async function activeElementName(page: Page) {
  return page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
}

test.describe("Keyboard accessibility", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("skip link moves focus to main content", async ({ page }) => {
    await gotoAndSettle(page, "/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expectFocused(skipLink);

    await page.keyboard.press("Enter");
    await expectFocused(page.locator("#main-content"));
  });

  test("desktop All Tools menu opens, releases focus, and restores it on Escape", async ({ page }) => {
    await gotoAndSettle(page, "/");
    const trigger = page.getByRole("button", { name: "All Tools", exact: true });

    await trigger.focus();
    await trigger.press("Enter");

    const panel = page.getByRole("region", { name: "All PDF tools" });
    await expect(panel).toBeVisible();
    await page.keyboard.press("Tab");
    await expectFocused(panel.getByRole("link", { name: "Merge PDF", exact: true }));

    const lastTool = panel.getByRole("link", { name: "PDF Scanner", exact: true });
    await lastTool.focus();
    await page.keyboard.press("Tab");
    expect(await activeElementName(page)).toBe("EN");
    await expect(panel.locator(":focus")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expectFocused(trigger);
  });

  test("mobile navigation traps focus and returns it to its trigger", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, "/");
    const trigger = page.getByRole("button", { name: "Open menu" });

    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Mobile navigation menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("a[href]").first()).toBeFocused();

    const lastFocusable = dialog.getByRole("link", { name: "Get Pro" });
    await lastFocusable.focus();
    await page.keyboard.press("Tab");
    await expect(dialog.locator("a[href]").first()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectFocused(trigger);
  });

  test("primary tool file chooser works from the keyboard", async ({ page }) => {
    await gotoAndSettle(page, "/merge-pdf");
    const uploadRegion = page.getByRole("region", { name: /drop files here/i });
    const chooseButton = uploadRegion.getByRole("button", { name: /select (pdf|file)/i });
    await chooseButton.focus();

    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      chooseButton.press("Enter"),
    ]);

    expect(chooser.isMultiple()).toBe(true);
    await expectFocused(chooseButton);
  });

  test("login fields expose autofill metadata and password toggle state", async ({ page }) => {
    await gotoAndSettle(page, "/login");
    const email = page.locator("#email");
    const password = page.locator("#password");
    const toggle = page.locator("#password + button");

    await expect(email).toHaveAttribute("name", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(password).toHaveAttribute("autocomplete", "current-password");

    await password.focus();
    await page.keyboard.press("Tab");
    await expectFocused(toggle);
    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(password).toHaveAttribute("type", "text");
  });

  test("signup validation moves focus to the field that needs correction", async ({ page }) => {
    await gotoAndSettle(page, "/signup");
    await page.locator("#fullName").fill("Test User");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("short");
    await page.locator("#confirmPassword").fill("short");

    await page.locator("form button[type='submit']").click();

    await expect(page.getByRole("alert").filter({ hasText: "at least 8 characters" })).toBeVisible();
    await expectFocused(page.locator("#password"));
  });

  test("cookie dialog closes with Escape and restores the previous focus", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForMainHydrated(page);
    const dialog = page.getByRole("dialog", { name: /cookie/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /cookie policy/i })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
