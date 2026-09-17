import { describe, expect, it } from "vitest";
import {
  isHybridScannedPdf,
  isImageHeavyPdf,
  isTextRichManual,
} from "@/lib/services/pdf-to-word-hints.service";

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
