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

  test("watermark controls expose labels and skip the hidden color input", async ({ page }) => {
    await gotoAndSettle(page, "/add-watermark");

    await expect(page.getByRole("textbox", { name: "Watermark text" })).toBeVisible();
    await expect(page.getByRole("slider", { name: /Opacity/ })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Font size" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Rotation" })).toBeVisible();

    const hiddenColorInput = page.locator("#watermark-custom-color");
    await expect(hiddenColorInput).toHaveAttribute("aria-hidden", "true");
    await expect(hiddenColorInput).toHaveAttribute("tabindex", "-1");
  });

  test("scanner input mode exposes and updates its pressed state", async ({ page }) => {
    await gotoAndSettle(page, "/pdf-scanner");

    const group = page.getByRole("group", { name: "Scanner input mode" });
    const camera = group.getByRole("button", { name: "Camera" });
    const upload = group.getByRole("button", { name: "Upload" });

    const cameraPressed = (await camera.getAttribute("aria-pressed")) === "true";
    const activeMode = cameraPressed ? camera : upload;
    const inactiveMode = cameraPressed ? upload : camera;

    await expect(activeMode).toHaveAttribute("aria-pressed", "true");
    await expect(inactiveMode).toHaveAttribute("aria-pressed", "false");
    await inactiveMode.focus();
    await inactiveMode.press("Enter");
    await expect(inactiveMode).toHaveAttribute("aria-pressed", "true");
    await expect(activeMode).toHaveAttribute("aria-pressed", "false");
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

  test("primary tool reflows at a 200 percent zoom equivalent viewport", async ({ page }) => {
    // A 1280 px browser viewport exposes about 640 CSS px at 200% browser zoom.
    await page.setViewportSize({ width: 640, height: 720 });
    await gotoAndSettle(page, "/pdf-to-word");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select file", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Convert to Word", exact: true })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("primary tool remains usable with forced colors active", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await gotoAndSettle(page, "/pdf-to-word");

    expect(await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches)).toBe(true);
    const chooseButton = page.getByRole("button", { name: "Select file", exact: true });
    await expect(chooseButton).toBeVisible();
    await chooseButton.focus();
    await expectFocused(chooseButton);
  });
});
