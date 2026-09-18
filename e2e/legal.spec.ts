import { test, expect } from "@playwright/test";
import { gotoAndSettle } from "./helpers";

test.describe("Legal & branding", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test("homepage uses OnlyMyPDF branding", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await expect(page.getByText("OnlyMyPDF").first()).toBeVisible();
    await expect(page.getByText("Only4PDF")).toHaveCount(0);
  });

  test("terms page uses OnlyMyPDF not Only4PDF", async ({ page }) => {
    await gotoAndSettle(page, "/terms");
    await expect(page.getByText("OnlyMyPDF").first()).toBeVisible();
    await expect(page.getByText("Only4PDF")).toHaveCount(0);
  });

  test("privacy page uses OnlyMyPDF not Only4PDF", async ({ page }) => {
    await gotoAndSettle(page, "/privacy");
    await expect(page.getByText("OnlyMyPDF").first()).toBeVisible();
    await expect(page.getByText("Only4PDF")).toHaveCount(0);
    await expect(page.getByText(/Cloudflare R2/).first()).toBeVisible();
    await expect(page.getByText(/Railway/).first()).toBeVisible();
    await expect(page.getByText(/does not sell personal data/i).first()).toBeVisible();
  });

  test("cookie page distinguishes essential storage from inactive optional tags", async ({ page }) => {
    await gotoAndSettle(page, "/cookies");
    await expect(page.getByText(/pd_guest_session/).first()).toBeVisible();
    await expect(page.getByText(/does not load an analytics tag/i).first()).toBeVisible();
    await expect(page.getByText(/does not load advertising or marketing tags/i).first()).toBeVisible();
  });

  test("trust center states accuracy and certification limits", async ({ page }) => {
    await gotoAndSettle(page, "/trust");
    await expect(page.getByText(/does not promise perfect conversion/i).first()).toBeVisible();
    await expect(page.getByText(/does not currently claim SOC 2/i).first()).toBeVisible();
    await expect(page.getByText(/certificate-based digital signature/i).first()).toBeVisible();
  });

  test("status page shows customer-facing fallback without operator setup instructions", async ({ page }) => {
    await page.route("**/api/health", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", timestamp: "2026-09-18T00:00:00.000Z" }),
      })
    );
    await gotoAndSettle(page, "/status");
    await expect(page.getByText("All systems operational")).toBeVisible();
    await expect(page.getByText(/Public incident history and update subscriptions are not available yet/i)).toBeVisible();
    await expect(page.getByText(/NEXT_PUBLIC_STATUS_PAGE_URL/)).toHaveCount(0);
  });

  test("refund page mentions refund policy and Razorpay", async ({ page }) => {
    await gotoAndSettle(page, "/refund");
    await expect(page.getByText("OnlyMyPDF").first()).toBeVisible();
    await expect(page.getByText(/refund policy|Refund Policy/i).first()).toBeVisible();
    await expect(page.getByText(/Razorpay/i).first()).toBeVisible();
  });

  test("faq page includes accurate billing and file limit copy", async ({ page }) => {
    await gotoAndSettle(page, "/faq");
    await expect(page.getByText("Account & Billing").first()).toBeVisible();

    const paymentBtn = page.getByRole("button", { name: "What payment methods are accepted?" });
    await paymentBtn.scrollIntoViewIfNeeded();
    await paymentBtn.click();
    await expect(page.getByText(/Razorpay/i).first()).toBeVisible({ timeout: 10_000 });

    const sizeBtn = page.getByRole("button", {
      name: "What is the maximum file size I can upload?",
    });
    await sizeBtn.scrollIntoViewIfNeeded();
    await sizeBtn.click();
    await expect(page.getByText(/Free:.*25/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
