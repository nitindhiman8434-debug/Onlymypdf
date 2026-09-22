import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  analyzeDocxLayout,
  isRasterPageExport,
  matchesSmallPdfClassLayout,
} from "@/lib/services/docx-layout-profile";
import { isDocxConversionAcceptable } from "@/lib/services/pdf-to-word-docx-post.service";
import {
  resolveConversionStrategy,
  resolvePdfToWordEngineOrder,
} from "@/lib/services/pdf-to-word-engine-plan";

async function buildDocx(
  documentXml: string,
  mediaNames: string[] = [],
  paddingBytes = 512
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("word/document.xml", documentXml);
  for (const name of mediaNames) {
    zip.file(name, Buffer.alloc(paddingBytes, 1));
  }
  zip.file("[Content_Types].xml", "<Types></Types>");
  zip.file("word/_rels/document.xml.rels", "<Relationships></Relationships>");
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

describe("PDF→Word quality regression (CI)", () => {
  it("flags old OnlyMyPDF-style raster export (letter + 33 PNGs, no text)", async () => {
    const xml =
      `<w:document ${NS}>` +
      `<w:body><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body>` +
      `</w:document>`;
    const media = Array.from({ length: 33 }, (_, i) => `word/media/page-${i}.png`);
    const buffer = await buildDocx(xml, media);

    const profile = await analyzeDocxLayout(buffer);
    expect(profile.pageWidthPt).toBeCloseTo(612, 0);
    expect(profile.pageHeightPt).toBeCloseTo(792, 0);
    expect(isRasterPageExport(profile, 33)).toBe(true);
    expect(matchesSmallPdfClassLayout(profile, 33)).toBe(false);
    await expect(
      isDocxConversionAcceptable(buffer, { pageCount: 33, pdfTextChars: 800 })
    ).resolves.toBe(false);
  });

  it("accepts Smallpdf-class poster layout (960×540, anchors, text)", async () => {
    const xml =
      `<w:document ${NS}>` +
      `<w:body>` +
      `<w:p><w:r><w:t>INFOGRAPHIC POSTER BRIEF</w:t></w:r></w:p>` +
      `<w:p><w:r><w:drawing><wp:anchor distT="0"><wp:positionH/></wp:anchor></w:drawing></w:r></w:p>` +
      `<w:sectPr><w:pgSz w:w="19200" w:h="10800"/></w:sectPr>` +
      `</w:body></w:document>`;
    const buffer = await buildDocx(xml, ["word/media/shape-1.png"]);

    const profile = await analyzeDocxLayout(buffer);
    expect(profile.pageWidthPt).toBeCloseTo(960, 0);
    expect(profile.pageHeightPt).toBeCloseTo(540, 0);
    expect(profile.anchors).toBeGreaterThan(0);
    expect(isRasterPageExport(profile, 1)).toBe(false);
    expect(matchesSmallPdfClassLayout(profile, 1)).toBe(true);
    await expect(
      isDocxConversionAcceptable(buffer, { pageCount: 1, pdfTextChars: 800 })
    ).resolves.toBe(true);
  });

  it("accepts Word COM-style export (poster size, inline drawings + text boxes)", async () => {
    const xml =
      `<w:document ${NS}>` +
      `<w:body>` +
      `<w:p><w:r><w:t>RESEARCH and KNOWLEDGE EXCHANGE</w:t></w:r></w:p>` +
      `<w:p><w:r><w:drawing><wp:inline/></w:drawing></w:r></w:p>` +
      `<w:txbxContent><w:p><w:r><w:t>Poster body</w:t></w:r></w:p></w:txbxContent>` +
      `<w:sectPr><w:pgSz w:w="19200" w:h="10800"/></w:sectPr>` +
      `</w:body></w:document>`;
    const buffer = await buildDocx(xml, Array.from({ length: 8 }, (_, i) => `word/media/img-${i}.png`));

    const profile = await analyzeDocxLayout(buffer);
    expect(matchesSmallPdfClassLayout(profile, 1)).toBe(true);
  });
});

describe("PDF→Word engine plan (CI)", () => {
  it("keeps dense selectable forms editable when a reference conversion is available", () => {
    const strategy = resolveConversionStrategy({
      platform: "win32",
      convertApiAvailable: false,
      convertApiOnly: false,
      denseEditableForm: true,
      pdf2docxReady: true,
      wordComReady: false,
    });
    expect(strategy.engines).toEqual(["reference-transcript"]);
    expect(strategy.emergency).toEqual(["node"]);
    expect([...strategy.engines, ...strategy.emergency]).not.toContain("visual");
  });

  it("routes short dense text to a readable reference plus transcript", () => {
    const strategy = resolveConversionStrategy({
      platform: "linux",
      convertApiAvailable: false,
      convertApiOnly: false,
      denseShortDocument: true,
      pdf2docxReady: true,
    });
    expect(strategy.engines).toEqual(["reference-transcript"]);
  });

  it("does not silently return an image-only Word fallback when OCR is required", () => {
    const strategy = resolveConversionStrategy({
      platform: "win32",
      convertApiAvailable: false,
      convertApiOnly: false,
      imageOnly: true,
      ocrRequired: true,
      pdf2docxReady: true,
    });
    expect(strategy.engines).toEqual(["pdf2docx"]);
    expect(strategy.emergency).toEqual([]);
  });

  it("prefers ConvertAPI first on all platforms when configured", () => {
    expect(
      resolvePdfToWordEngineOrder({
        platform: "linux",
        convertApiAvailable: true,
        convertApiOnly: false,
      })[0]
    ).toBe("convertapi");

    expect(
      resolvePdfToWordEngineOrder({
        platform: "win32",
        convertApiAvailable: true,
        convertApiOnly: false,
      })[0]
    ).toBe("convertapi");
  });

  it("skips Word COM and LibreOffice in ConvertAPI-only production mode", () => {
    const order = resolvePdfToWordEngineOrder({
      platform: "win32",
      convertApiAvailable: true,
      convertApiOnly: true,
      pdf2docxReady: true,
    });
    expect(order).toEqual(["convertapi", "pdf2docx", "visual", "node"]);
    expect(order).not.toContain("word-com");
    expect(order).not.toContain("libreoffice");
  });

  it("prefers pdf2docx before Word COM for text-rich manuals", () => {
    const order = resolvePdfToWordEngineOrder({
      platform: "win32",
      convertApiAvailable: false,
      convertApiOnly: false,
      textRichManual: true,
      pdf2docxReady: true,
      wordComReady: true,
    });
    expect(order.indexOf("pdf2docx")).toBeLessThan(order.indexOf("word-com"));
  });

  it("keeps Word COM before pdf2docx for design posters", () => {
    const order = resolvePdfToWordEngineOrder({
      platform: "win32",
      convertApiAvailable: false,
      convertApiOnly: false,
      textRichManual: false,
      pdf2docxReady: true,
      wordComReady: true,
    });
    expect(order.indexOf("word-com")).toBeLessThan(order.indexOf("pdf2docx"));
  });

  it("limits primary engines to at most two before emergency fallbacks", () => {
    const strategy = resolveConversionStrategy({
      platform: "win32",
      convertApiAvailable: true,
      convertApiOnly: false,
      textRichManual: false,
      wordComReady: true,
      pdf2docxReady: true,
    });
    expect(strategy.engines.length).toBeLessThanOrEqual(2);
    expect(strategy.emergency).toEqual(["visual", "node"]);
  });

  it("omits emergency fallbacks for large PDFs", () => {
    const strategy = resolveConversionStrategy({
      platform: "win32",
      convertApiAvailable: false,
      convertApiOnly: false,
      textRichManual: true,
      largePdf: true,
      pdf2docxReady: true,
    });
    expect(strategy.emergency).toEqual([]);
  });

  it("prefers pdf2docx before Word COM for hybrid scanned PDFs", () => {
    const order = resolvePdfToWordEngineOrder({
      platform: "win32",
      convertApiAvailable: false,
      convertApiOnly: false,
      hybridScanned: true,
      pdf2docxReady: true,
      wordComReady: true,
    });
    expect(order.indexOf("pdf2docx")).toBeLessThan(order.indexOf("word-com"));
    expect(order[0]).toBe("pdf2docx");
  });
});
