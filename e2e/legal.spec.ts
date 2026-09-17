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
