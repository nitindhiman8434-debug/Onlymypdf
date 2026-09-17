import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { sanitizeTextForStandardFont } from "./pdf-standard-font-text";

describe("sanitizeTextForStandardFont", () => {
  it("replaces rupee and arrow symbols with ASCII fallbacks", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const input = "Budget: ₹10k–₹12k/month and scale -> production";
    const sanitized = sanitizeTextForStandardFont(input, font);

    expect(sanitized).toContain("Rs.10k");
    expect(sanitized).toContain("Rs.12k");
    expect(() => font.widthOfTextAtSize(sanitized, 11)).not.toThrow();

    const page = pdf.addPage();
    expect(() =>
      page.drawText(sanitized, { x: 50, y: 700, size: 11, font })
    ).not.toThrow();
  });

  it("preserves line separators and expands tabs before drawing", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    expect(sanitizeTextForStandardFont("Line 1\r\n\r\nLine\t2", font)).toBe(
      "Line 1\r\n\r\nLine    2"
    );
  });
});
