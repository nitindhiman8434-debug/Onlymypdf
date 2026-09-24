import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.env.ONLYMYPDF_BASE_URL ?? "http://127.0.0.1:3001";
const fixture = path.resolve(
  "quality/phase2-pdf-to-excel/fixtures/phase1-table-regression.pdf"
);

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--force-renderer-accessibility", "--start-maximized"],
});

try {
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/pdf-to-word`, { waitUntil: "networkidle" });
  await page.bringToFront();
  const rejectCookies = page.getByRole("button", {
    name: "Reject non-essential",
    exact: true,
  });
  if (await rejectCookies.isVisible()) {
    await rejectCookies.click();
  }
  const fileInput = page.locator('input[type="file"]');
  const convertButton = page.getByRole("button", { name: "Convert to Word" });
  const selectFixture = async () => {
    await fileInput.setInputFiles([]);
    await fileInput.setInputFiles(fixture);
    await page
      .getByText("phase1-table-regression.pdf", { exact: true })
      .waitFor({ state: "visible", timeout: 10_000 });
  };
  await selectFixture();
  console.log("NVDA_CHECK_ARMED: conversion starts in 15 seconds");
  await page.waitForTimeout(15_000);
  if (!(await convertButton.isEnabled())) {
    await selectFixture();
  }
  await convertButton.click({ timeout: 60_000 });
  await page
    .getByRole("heading", { name: "Converted Successfully!" })
    .waitFor({ state: "visible", timeout: 120_000 });
  await page.bringToFront();
  console.log(
    "NVDA_CHECK_READY: Converted Successfully! Your Word document is ready to download."
  );
  await page.waitForTimeout(45_000);
} finally {
  await browser.close();
}
