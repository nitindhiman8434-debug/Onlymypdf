import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { apiOriginHeaders, gotoAndSettle, uploadPdfFiles } from "./helpers";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

async function writeTestPdf(relativeName: string, pages: number): Promise<string> {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const filePath = path.join(FIXTURES_DIR, relativeName);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage();
    page.drawText(`E2E page ${i + 1}`, { x: 72, y: 700, size: 14, font });
  }
  fs.writeFileSync(filePath, await pdf.save());
  return filePath;
}

test.describe("PDF conversion (client-side)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await writeTestPdf("merge-a.pdf", 1);
    await writeTestPdf("merge-b.pdf", 1);
    await writeTestPdf("split-two-pages.pdf", 2);
  });

  test("merge workspace loads two uploaded PDFs", async ({ page }) => {
    test.setTimeout(120_000);

    const fileA = path.join(FIXTURES_DIR, "merge-a.pdf");
    const fileB = path.join(FIXTURES_DIR, "merge-b.pdf");

    await gotoAndSettle(page, "/merge-pdf");
    await expect(page.getByRole("button", { name: /Select PDF|Select file/i })).toBeVisible({
      timeout: 30_000,
    });

    await uploadPdfFiles(page, [fileA, fileB]);

    await expect(page.getByText("merge-a.pdf")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("merge-b.pdf")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Export" })).toBeEnabled({ timeout: 60_000 });
  });

  test("merge API returns a combined PDF for two real files", async ({ request }) => {
    const fileA = fs.readFileSync(path.join(FIXTURES_DIR, "merge-a.pdf"));
    const fileB = fs.readFileSync(path.join(FIXTURES_DIR, "merge-b.pdf"));

    const form = new FormData();
    form.append("files", new Blob([fileA], { type: "application/pdf" }), "merge-a.pdf");
    form.append("files", new Blob([fileB], { type: "application/pdf" }), "merge-b.pdf");

    const res = await request.post("/api/tools/merge-pdf", {
      multipart: form,
      headers: apiOriginHeaders(),
    });

    if (!res.ok()) {
      const errBody = await res.text();
      throw new Error(`merge API ${res.status()}: ${errBody.slice(0, 400)}`);
    }

    expect(res.headers()["content-type"]).toContain("application/pdf");
    const body = await res.body();
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
    expect(body.length).toBeGreaterThan(200);

    const merged = await PDFDocument.load(body, { ignoreEncryption: true });
    expect(merged.getPageCount()).toBe(2);
  });

  test("split PDF shows workspace after upload", async ({ page }) => {
    test.setTimeout(90_000);

    const file = path.join(FIXTURES_DIR, "split-two-pages.pdf");

    await gotoAndSettle(page, "/split-pdf");
    const selectBtn = page.getByRole("button", { name: "Select PDF" });
    await expect(selectBtn).toBeVisible({ timeout: 30_000 });

    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      selectBtn.click(),
    ]);
    await chooser.setFiles(file);

    await expect(page.getByText(/\d+ pages/i).first()).toBeVisible({ timeout: 60_000 });
  });

  test("split PDF extract tab starts with no pages selected", async ({ page }) => {
    test.setTimeout(120_000);

    const file = path.join(FIXTURES_DIR, "split-two-pages.pdf");

    await gotoAndSettle(page, "/split-pdf");
    await uploadPdfFiles(page, file);

    // Click Extract immediately — before thumbnails finish loading
    await page.getByRole("button", { name: "Extract", exact: true }).click();
    await expect(page.getByText(/^0 of \d+ selected$/)).toBeVisible({ timeout: 60_000 });

    const selectAll = page.getByRole("button", { name: "Select all" });
    await expect(selectAll).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0);
  });

  test("split PDF extract tab stays unselected after thumbnails load", async ({ page }) => {
    test.setTimeout(120_000);

    const file = path.join(FIXTURES_DIR, "split-two-pages.pdf");

    await gotoAndSettle(page, "/split-pdf");
    await uploadPdfFiles(page, file);
    await expect(page.getByText(/\d+ pages/i).first()).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Extract", exact: true }).click();
    await expect(page.getByText(/^0 of \d+ selected$/)).toBeVisible({ timeout: 15_000 });

    const selectAll = page.getByRole("button", { name: "Select all" });
    await expect(selectAll).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0);
  });
});

test.describe("Status page", () => {
  test("loads and shows health section", async ({ page }) => {
    await gotoAndSettle(page, "/status");
    await expect(page.getByRole("heading", { name: "System Status" })).toBeVisible();
    await expect(page.getByText("Current status")).toBeVisible({ timeout: 30_000 });
  });
});
