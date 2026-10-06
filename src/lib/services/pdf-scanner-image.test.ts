import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseScannerFilter } from "@/config/pdf-scanner";
import { prepareScannerImage } from "./pdf-scanner-image";

async function rgb(bytes: Buffer) {
  return sharp(bytes).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
}

describe("scanner filter contract", () => {
  it.each([
    [null, "none"], ["", "none"], ["original", "none"], ["bw", "blackwhite"],
    ["enhanced", "highcontrast"], ["none", "none"], ["grayscale", "grayscale"],
    ["blackwhite", "blackwhite"], ["highcontrast", "highcontrast"], ["brighten", "brighten"],
  ])("maps %s without silently losing the selected filter", (input, expected) => {
    expect(parseScannerFilter(input)).toBe(expected);
  });
  it.each(["invalid", "BW", " enhanced ", 1, {}, new Blob(["bw"])])("rejects invalid filter %s", (value) => {
    expect(parseScannerFilter(value)).toBeNull();
  });
});

describe("scanner output pixels", () => {
  it("Original retains the decoded RGB colors without enhancement", async () => {
    const pixels = Buffer.from([20, 40, 80, 180, 30, 70, 220, 200, 160, 60, 190, 40]);
    const input = await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).png().toBuffer();
    const result = await prepareScannerImage(input, "none");
    expect((await rgb(result)).data).toEqual(pixels);
    expect((await sharp(result).metadata()).format).toBe("png");
  });
  it("Black & White actually thresholds pixels on both sides of 128", async () => {
    const levels = [0, 64, 127, 128, 192, 255];
    const pixels = Buffer.from(levels.flatMap((value) => [value, value, value]));
    const input = await sharp(pixels, { raw: { width: 6, height: 1, channels: 3 } }).png().toBuffer();
    const result = (await rgb(await prepareScannerImage(input, "blackwhite"))).data;
    expect([...result]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  });
  it("Enhanced expands contrast in a deliberately faint pattern", async () => {
    const pixels = Buffer.alloc(32 * 32 * 3);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      pixels.fill(x < 16 ? 140 : 170, (y * 32 + x) * 3, (y * 32 + x + 1) * 3);
    }
    const input = await sharp(pixels, { raw: { width: 32, height: 32, channels: 3 } }).png().toBuffer();
    const result = await rgb(await prepareScannerImage(input, "highcontrast"));
    expect(result.info.width).toBe(32);
    expect(result.info.height).toBe(32);
    expect(Math.max(...result.data) - Math.min(...result.data)).toBeGreaterThan(150);
    expect(result.data.equals(pixels)).toBe(false);
  });
  it("honors phone EXIF orientation before removing metadata", async () => {
    const pixels = Buffer.alloc(12 * 8 * 3);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      const offset = (y * 12 + x) * 3;
      pixels[offset] = x < 6 ? 230 : 20;
      pixels[offset + 1] = y < 4 ? 210 : 30;
      pixels[offset + 2] = 50;
    }
    const input = await sharp(pixels, { raw: { width: 12, height: 8, channels: 3 } })
      .jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).withMetadata({ orientation: 6 }).toBuffer();
    const source = await rgb(input);
    const result = await rgb(await prepareScannerImage(input, "none"));
    expect([result.info.width, result.info.height]).toEqual([8, 12]);
    // EXIF 6 is a clockwise quarter turn. Compare every decoded source pixel.
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      const before = (y * 12 + x) * 3;
      const after = (x * 8 + 7 - y) * 3;
      expect(result.data.subarray(after, after + 3)).toEqual(source.data.subarray(before, before + 3));
    }
    const metadata = await sharp(await prepareScannerImage(input, "none")).metadata();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });
});
