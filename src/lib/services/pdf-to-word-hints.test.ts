import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  estimatePdfHintsFromBuffer,
  isDenseEditableForm,
  isDenseShortDocument,
  isHybridScannedPdf,
  isImageHeavyPdf,
  isTextRichManual,
} from "@/lib/services/pdf-to-word-hints.service";

async function compactRasterPdf(pages = 1, finalText?: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=", "base64"
  ));
  for (let index = 0; index < pages; index += 1) {
    const page = pdf.addPage([200, 200]);
    page.drawImage(image, { x: 0, y: 0, width: 200, height: 200 });
    if (index === pages - 1 && finalText) page.drawText(finalText, { x: 30, y: 30, size: 12 });
  }
  return Buffer.from(await pdf.save());
}

describe("actual selectable-text scan evidence", () => {
  it("recognizes a compact raster PDF below the image-size heuristic", async () => {
    const input = await compactRasterPdf();
    expect(input.length).toBeLessThan(150_000);
    expect((await estimatePdfHintsFromBuffer(input)).imageOnly).toBe(true);
  });

  it("does not classify a short selectable label as an image-only scan", async () => {
    const input = await compactRasterPdf(1, "7");
    expect((await estimatePdfHintsFromBuffer(input)).imageOnly).toBe(false);
  });

  it("checks pages beyond the initial sample before declaring a scan", async () => {
    expect((await estimatePdfHintsFromBuffer(await compactRasterPdf(6))).imageOnly).toBe(true);
    expect((await estimatePdfHintsFromBuffer(await compactRasterPdf(6, "Selectable final page"))).imageOnly).toBe(false);
  });
});

describe("isDenseEditableForm", () => {
  it("routes a short form with many fields and selectable text to the fast reference path", () => {
    expect(isDenseEditableForm({ pageCount: 2, pdfTextChars: 10_000, formFieldCount: 199 })).toBe(true);
    expect(isDenseEditableForm({ pageCount: 2, pdfTextChars: 10_000, formFieldCount: 4 })).toBe(false);
    expect(isDenseEditableForm({ pageCount: 2, pdfTextChars: 0, formFieldCount: 199 })).toBe(false);
  });
});

describe("isDenseShortDocument", () => {
  it("chooses a visual reference plus editable transcript for dense short text", () => {
    expect(isDenseShortDocument({ pageCount: 8, pdfTextChars: 35_000 })).toBe(true);
    expect(isDenseShortDocument({ pageCount: 8, pdfTextChars: 10_000 })).toBe(false);
    expect(isDenseShortDocument({ pageCount: 64, pdfTextChars: 280_000 })).toBe(false);
  });
});

describe("isTextRichManual", () => {
  it("detects dense multi-page manuals by text volume", () => {
    expect(isTextRichManual({ pageCount: 64, pdfTextChars: 120_000 }, 700_000)).toBe(true);
  });

  it("detects manuals when text parse fails but file is large enough", () => {
    expect(isTextRichManual({ pageCount: 64 }, 710_000)).toBe(true);
  });

  it("does not flag short design PDFs", () => {
    expect(isTextRichManual({ pageCount: 33, pdfTextChars: 200 }, 12_000_000)).toBe(false);
  });

  it("detects manuals when page count is estimated from file size", () => {
    expect(isTextRichManual({ pageCount: 65, pdfTextChars: 10_421 }, 710_000)).toBe(true);
  });
});

describe("isImageHeavyPdf", () => {
  it("flags large design posters with little text", () => {
    expect(isImageHeavyPdf({ pageCount: 33, pdfTextChars: 480 }, 12_000_000)).toBe(true);
  });

  it("does not flag dense manuals", () => {
    expect(isImageHeavyPdf({ pageCount: 64, pdfTextChars: 122_718 }, 710_000)).toBe(false);
  });
});

describe("isHybridScannedPdf", () => {
  it("detects journal PDFs with full-page scan backgrounds", () => {
    expect(
      isHybridScannedPdf({ pageCount: 6, pdfTextChars: 28_059 }, 10_465_670)
    ).toBe(true);
  });

  it("does not flag design posters (image-heavy)", () => {
    expect(isHybridScannedPdf({ pageCount: 33, pdfTextChars: 480 }, 12_000_000)).toBe(false);
  });

  it("does not flag dense manuals", () => {
    expect(isHybridScannedPdf({ pageCount: 64, pdfTextChars: 122_718 }, 710_000)).toBe(false);
  });

  it("does not flag small text-only PDFs", () => {
    expect(isHybridScannedPdf({ pageCount: 2, pdfTextChars: 4_000 }, 80_000)).toBe(false);
  });
});
