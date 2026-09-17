import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  isDocxConversionAcceptable,
  shouldPostProcessDocx,
} from "@/lib/services/pdf-to-word-docx-post.service";

async function buildDocxXml(documentXml: string, mediaNames: string[] = []): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("word/document.xml", documentXml);
  for (const name of mediaNames) {
    zip.file(name, Buffer.alloc(512, 1));
  }
  zip.file("[Content_Types].xml", "<Types></Types>");
  zip.file("word/_rels/document.xml.rels", "<Relationships></Relationships>");
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("isDocxConversionAcceptable", () => {
  it("rejects full-page raster exports with no anchors or text", async () => {
    const xml =
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:drawing/></w:r></w:p></w:body></w:document>';
    const media = Array.from({ length: 33 }, (_, i) => `word/media/page-${i}.png`);
    const buffer = await buildDocxXml(xml, media);

    await expect(
      isDocxConversionAcceptable(buffer, { pageCount: 33, pdfTextChars: 1200 })
    ).resolves.toBe(false);
  });

  it("accepts anchored layout exports with editable text", async () => {
    const xml =
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:t>INFOGRAPHIC POSTER BRIEF</w:t></w:r></w:p>' +
      '<w:p><w:r><w:drawing><wp:anchor distT="0"><wp:positionH/></wp:anchor></w:drawing></w:r></w:p></w:body></w:document>';
    const buffer = await buildDocxXml(xml, ["word/media/shape-1.png"]);

    await expect(
      isDocxConversionAcceptable(buffer, { pageCount: 1, pdfTextChars: 1200 })
    ).resolves.toBe(true);
  });

  it("accepts pdf2docx full-page image exports for hybrid scanned PDFs", async () => {
    const xml =
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:drawing/></w:r></w:p></w:body></w:document>';
    const media = Array.from({ length: 6 }, (_, i) => `word/media/page-${i}.png`);
    const zip = new JSZip();
    zip.file("word/document.xml", xml);
    for (const name of media) {
      zip.file(name, Buffer.alloc(2_000_000, 1));
    }
    zip.file("[Content_Types].xml", "<Types></Types>");
    zip.file("word/_rels/document.xml.rels", "<Relationships></Relationships>");
    const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));

    await expect(
      isDocxConversionAcceptable(buffer, {
        pageCount: 6,
        pdfTextChars: 28_000,
        byteLength: 10_465_670,
        hybridScanned: true,
      })
    ).resolves.toBe(true);
  });

  it("rejects broken word-com exports for hybrid scanned PDFs", async () => {
    const xml =
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:t>Some article text preserved</w:t></w:r></w:p></w:body></w:document>';
    const buffer = await buildDocxXml(xml, ["word/media/tiny.jpg"]);

    await expect(
      isDocxConversionAcceptable(buffer, {
        pageCount: 6,
        pdfTextChars: 28_000,
        byteLength: 10_465_670,
        hybridScanned: true,
      })
    ).resolves.toBe(false);
  });
});

describe("shouldPostProcessDocx", () => {
  it("skips center-to-left rewrite for anchored documents", async () => {
    const xml =
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:drawing><wp:anchor distT="0"><wp:positionH/></wp:anchor></w:drawing></w:r></w:p></w:body></w:document>';
    const buffer = await buildDocxXml(xml, ["word/media/padding.bin"]);

    await expect(shouldPostProcessDocx(buffer)).resolves.toBe(false);
  });
});
