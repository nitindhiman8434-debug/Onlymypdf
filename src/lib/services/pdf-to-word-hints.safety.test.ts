import { describe, expect, it } from "vitest";
import {
  isHybridScannedPdf,
  resolvePdfHintsSafe,
} from "@/lib/services/pdf-to-word-hints.service";

describe("resolvePdfHintsSafe", () => {
  it("never throws on corrupt PDF bytes", async () => {
    const corrupt = Buffer.from("not-a-real-pdf-content", "utf8");
    await expect(
      resolvePdfHintsSafe({ buffer: corrupt, byteLength: corrupt.length })
    ).resolves.toMatchObject({
      byteLength: corrupt.length,
      hybridScanned: false,
    });
  });

  it("never throws on zero byte length", async () => {
    await expect(resolvePdfHintsSafe({ byteLength: 0 })).resolves.toEqual({
      byteLength: 0,
      hybridScanned: false,
      pageCount: 1,
    });
  });

  it("returns safe fallback for corrupt buffer without throwing", async () => {
    const corrupt = Buffer.from("not-a-real-pdf-content", "utf8");
    const hints = await resolvePdfHintsSafe({ buffer: corrupt, byteLength: corrupt.length });
    expect(hints.byteLength).toBe(corrupt.length);
    expect(hints.hybridScanned).toBe(false);
    expect(hints.pageCount).toBeGreaterThan(0);
  });
});

describe("isHybridScannedPdf safety", () => {
  it("returns false for empty hints without throwing", () => {
    expect(isHybridScannedPdf({}, 0)).toBe(false);
    expect(isHybridScannedPdf({ pageCount: 0 }, 1000)).toBe(false);
  });
});
