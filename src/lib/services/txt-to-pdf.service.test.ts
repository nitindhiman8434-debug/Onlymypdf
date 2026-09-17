import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { StandardFonts } from "pdf-lib";
import {
  splitSanitizedTextLines,
  txtToPdf,
} from "@/lib/services/txt-to-pdf.service";

describe("txtToPdf", () => {
  it("converts text with rupee symbols without error", async () => {
    const text =
      "Premium SaaS plan for ₹10k–₹12k/month initial server budget.\n" +
      "Deploy -> monitor -> scale.";

    const buffer = await txtToPdf(text);
    expect(buffer.length).toBeGreaterThan(500);

    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
  });

  it("keeps Windows, Unix and blank lines before wrapping", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const lines = splitSanitizedTextLines(
      "Heading\r\n\r\nBudget: ₹10k\nDone → now",
      font
    );

    expect(lines).toEqual([
      "Heading",
      "",
      "Budget: Rs.10k",
      "Done -> now",
    ]);
  });
});
