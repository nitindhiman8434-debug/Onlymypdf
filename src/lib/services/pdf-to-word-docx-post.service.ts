import JSZip from "jszip";
import fs from "fs/promises";

import type { PdfToWordEngine } from "@/lib/services/pdf-to-word-engine-plan";
import { isImageHeavyPdf, isHybridScannedPdf, type PdfHintProfile } from "@/lib/services/pdf-to-word-hints.service";

export type DocxQualityMetrics = {
  chars: number;
  tables: number;
  drawings: number;
  anchors: number;
  media: number;
  bytes: number;
};

/**
 * Skip loading multi-MB document.xml for engines that already validate output.
 * pdf2docx manuals can produce 5MB+ document.xml — full JSZip parse freezes finalize.
 */
export async function isDocxFileBasicallyValid(outputPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(outputPath);
    if (!stat.isFile() || stat.size < 1500) return false;
    const handle = await fs.open(outputPath, "r");
    try {
      const head = Buffer.alloc(2);
      await handle.read(head, 0, 2, 0);
      return head[0] === 0x50 && head[1] === 0x4b;
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

export function canTrustEngineOutputWithoutFullScan(engine: PdfToWordEngine): boolean {
  return engine === "pdf2docx" || engine === "word-com" || engine === "convertapi";
}

function extractMetricsFromXml(xml: string, bytes: number, media: number): DocxQualityMetrics {
  const chars = (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).reduce(
    (sum, node) => sum + node.replace(/<[^>]+>/g, "").length,
    0
  );
  return {
    chars,
    tables: (xml.match(/<w:tbl/g) ?? []).length,
    drawings: (xml.match(/<w:drawing/g) ?? []).length,
    anchors: (xml.match(/wp:anchor/g) ?? []).length,
    media,
    bytes,
  };
}

export async function measureDocxQuality(buffer: Buffer): Promise<DocxQualityMetrics> {
  if (buffer.length < 1500) {
    return { chars: 0, tables: 0, drawings: 0, anchors: 0, media: 0, bytes: buffer.length };
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const doc = zip.file("word/document.xml");
    if (!doc) {
      return { chars: 0, tables: 0, drawings: 0, anchors: 0, media: 0, bytes: buffer.length };
    }
    const xml = await doc.async("string");
    const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media/")).length;
    return extractMetricsFromXml(xml, buffer.length, media);
  } catch {
    const text = buffer.toString("latin1");
    return extractMetricsFromXml(text, buffer.length, 0);
  }
}

/**
 * Reject empty or broken DOCX outputs before returning to the user.
 * Invoices/forms need text + layout artifacts; scanned PDFs may be image-heavy.
 */
export type DocxQualityHints = PdfHintProfile & {
  byteLength?: number;
  hybridScanned?: boolean;
};

export async function isDocxConversionAcceptable(
  buffer: Buffer,
  hints?: DocxQualityHints
): Promise<boolean> {
  if (buffer.length < 1500) return false;

  const metrics = await measureDocxQuality(buffer);
  const pages = Math.max(1, hints?.pageCount ?? 1);
  const hybridScanned = hints?.hybridScanned === true;
  const sourceBytes = hints?.byteLength ?? 0;

  if (hybridScanned) {
    const preservedImages =
      metrics.media >= Math.max(1, Math.ceil(pages * 0.5)) &&
      metrics.drawings + metrics.media >= Math.ceil(pages * 0.5);
    const preservedBulk =
      sourceBytes > 0 ? metrics.bytes >= sourceBytes * 0.12 : metrics.bytes >= 500_000;
    if (preservedImages && preservedBulk) return true;
  }

  const imageHeavy =
    sourceBytes > 0 ? isImageHeavyPdf(hints ?? {}, sourceBytes) : false;

  const minChars = imageHeavy
    ? 40
    : hints?.pdfTextChars
      ? Math.min(hints.pdfTextChars, Math.max(120, Math.floor(hints.pdfTextChars * 0.35)))
      : Math.max(80, pages * 60);

  const layoutTarget = imageHeavy ? Math.min(pages, 8) : pages;

  const hasStructure =
    metrics.chars >= minChars ||
    metrics.tables > 0 ||
    metrics.drawings >= layoutTarget ||
    metrics.media >= layoutTarget ||
    (imageHeavy && (metrics.anchors > 0 || metrics.drawings > 0));

  if (!hasStructure) return false;

  // pdf2docx sometimes emits huge files with almost no usable text.
  if (metrics.chars < 40 && metrics.tables === 0 && metrics.media === 0) {
    return false;
  }

  // Layout-heavy PDFs: reject text-only extractions with poor structure.
  if (hints?.pdfTextChars && hints.pdfTextChars > 700 && pages >= 1) {
    const layoutArtifacts = metrics.tables + metrics.drawings + metrics.media;
    if (layoutArtifacts < pages && metrics.chars < hints.pdfTextChars * 0.55) {
      return false;
    }
  }

  // Reject word-com style broken figure exports on hybrid scanned PDFs.
  if (
    hybridScanned &&
    sourceBytes > 0 &&
    metrics.bytes < sourceBytes * 0.05 &&
    metrics.media < Math.ceil(pages * 0.5)
  ) {
    return false;
  }

  // Full-page raster exports: one PNG per page, no anchors, no usable text.
  if (!hybridScanned && metrics.anchors === 0 && metrics.media >= pages && metrics.chars < 40) {
    return false;
  }

  // Reject full-page raster exports when the source PDF has extractable text.
  // Smallpdf/Word COM use anchored absolute layout; raster fallbacks use one PNG per page.
  // Hybrid scanned pdf2docx intentionally preserves page images — skip this rule.
  if (
    !hybridScanned &&
    hints?.pdfTextChars &&
    hints.pdfTextChars > 200 &&
    metrics.anchors === 0 &&
    metrics.media >= pages &&
    metrics.chars < hints.pdfTextChars * 0.45
  ) {
    return false;
  }

  return true;
}

/** Skip alignment tweaks when the DOCX uses absolute/anchored layout. */
export async function shouldPostProcessDocx(buffer: Buffer): Promise<boolean> {
  const metrics = await measureDocxQuality(buffer);
  return metrics.anchors === 0;
}

/**
 * Light post-process: left-align only. Images/tables preserved for layout fidelity.
 */
export async function postProcessDocx(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const xmlPaths = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header|footer|footnotes|endnotes)\d*\.xml$/.test(name)
  );

  for (const xmlPath of xmlPaths) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    let xml = await file.async("string");
    xml = xml.replace(/<w:jc w:val="center"/g, '<w:jc w:val="left"');
    zip.file(xmlPath, xml);
  }

  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 1 },
    })
  );
}

export function scoreDocxQuality(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const tables = (text.match(/<w:tbl/g) ?? []).length;
  const chars = (text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).reduce(
    (sum, node) => sum + (node.replace(/<[^>]+>/g, "").length ?? 0),
    0
  );
  const drawings = (text.match(/<w:drawing/g) ?? []).length;
  return tables * 800 + chars + drawings * 100;
}
