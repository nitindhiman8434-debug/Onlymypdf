import { describe, expect, it } from "vitest";
import { scannerSelectionError } from "./scanner-selection";

const image = (type = "image/jpeg") => ({ type });

describe("PDF scanner batch selection", () => {
  it("accepts exactly ten images and an append that fills the remaining slot", () => {
    expect(scannerSelectionError(0, Array.from({ length: 10 }, () => image()))).toBeNull();
    expect(scannerSelectionError(9, [image()])).toBeNull();
  });

  it.each([[0, 11], [9, 2], [10, 1]])("rejects the entire overflow batch at %i + %i", (existing, added) => {
    expect(scannerSelectionError(existing, Array.from({ length: added }, () => image())))
      .toContain("up to 10 images");
  });

  it("accepts a replacement after removal and treats cancelled file selection as empty", () => {
    expect(scannerSelectionError(9, [image()])).toBeNull();
    expect(scannerSelectionError(10, [])).toBeNull();
  });

  it("accepts all three server-supported image formats together", () => {
    expect(scannerSelectionError(0, [image("image/jpeg"), image("image/png"), image("image/webp")])).toBeNull();
  });

  it.each(["image/gif", "image/svg+xml", "image/heic", "application/pdf", ""])("rejects a mixed batch containing unsupported type %s", (type) => {
    expect(scannerSelectionError(1, [image(), image(type)]))
      .toBe("Choose JPG, PNG or WebP images. No pages from this batch were added.");
  });
});
