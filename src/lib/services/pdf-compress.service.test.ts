import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import {
  compressPDF,
  resolveCompressRasterPlan,
} from "@/lib/services/pdf-compress.service";

describe("resolveCompressRasterPlan", () => {
  it("uses lighter settings for basic than strong", () => {
    const basic = resolveCompressRasterPlan("basic", 50);
    const strong = resolveCompressRasterPlan("strong", 50);
    expect(basic.desiredWidth).toBeGreaterThan(strong.desiredWidth);
    expect(basic.quality).toBeGreaterThan(strong.quality);
  });

  it("narrows width for large page counts so strong still runs", () => {
    const small = resolveCompressRasterPlan("strong", 20);
    const large = resolveCompressRasterPlan("strong", 400);
    expect(large.desiredWidth).toBeLessThan(small.desiredWidth);
    expect(large.desiredWidth).toBeGreaterThan(0);
  });
});

describe("compressPDF size reduction", () => {
  it(
    "returns the exact original when Basic cannot make a meaningful lossless saving",
    async () => {
      const pdf = await PDFDocument.create();
      const raw = Buffer.alloc(600 * 800 * 3);
      for (let i = 0; i < raw.length; i++) raw[i] = (i * 31 + (i >> 5) * 17) % 256;
      const jpeg = await sharp(raw, {
        raw: { width: 600, height: 800, channels: 3 },
      })
        .jpeg({ quality: 88 })
        .toBuffer();
      const image = await pdf.embedJpg(jpeg);
      const page = pdf.addPage([612, 792]);
      page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
      const original = Buffer.from(await pdf.save());

      const basic = await compressPDF(original, "basic");

      if (basic.status === "already-optimized") {
        expect(basic.method).toBe("original");
        expect(basic.buffer.equals(original)).toBe(true);
        expect(basic.compressedSize).toBe(original.length);
      } else {
        expect(basic.method).toBe("structural");
        expect(basic.compressedSize).toBeLessThanOrEqual(original.length * 0.97);
      }
    },
    60_000
  );

  it(
    "shrinks an image-heavy PDF with strong compression",
    async () => {
      const pdf = await PDFDocument.create();
      for (let i = 0; i < 4; i++) {
        const jpeg = await sharp({
          create: {
            width: 1000,
            height: 1400,
            channels: 3,
            background: { r: 30 + i * 40, g: 90, b: 140 },
          },
        })
          .jpeg({ quality: 95 })
          .toBuffer();
        const img = await pdf.embedJpg(jpeg);
        const page = pdf.addPage([612, 792]);
        page.drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
      }
      const original = Buffer.from(await pdf.save());
      const strong = await compressPDF(original, "strong");
      expect(strong.compressedSize).toBeLessThan(original.length * 0.85);
      expect(strong.compressedSize).toBeGreaterThan(0);
      expect(strong.status).toBe("compressed");
      expect(strong.method).toBe("rasterized");
    },
    60_000
  );
});
