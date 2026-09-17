import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import { logError } from "@/lib/db/queries";

type RasterPlan = {
  desiredWidth: number;
  quality: number;
  batchSize: number;
};

export type CompressionResult = {
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
  status: "compressed" | "already-optimized";
  method: "structural" | "rasterized" | "original";
};

/**
 * Adaptive raster plan: large books use narrower width so they finish in time,
 * instead of skipping compression entirely (which left size unchanged).
 */
export function resolveCompressRasterPlan(
  level: "basic" | "strong",
  pageCount: number
): RasterPlan {
  const pages = Math.max(1, pageCount);

  if (level === "basic") {
    if (pages <= 40) return { desiredWidth: 1400, quality: 74, batchSize: 8 };
    if (pages <= 120) return { desiredWidth: 1100, quality: 70, batchSize: 10 };
    return { desiredWidth: 900, quality: 68, batchSize: 12 };
  }

  if (pages <= 40) return { desiredWidth: 1100, quality: 48, batchSize: 8 };
  if (pages <= 120) return { desiredWidth: 850, quality: 40, batchSize: 10 };
  return { desiredWidth: 720, quality: 34, batchSize: 12 };
}

function pickSmallestBuffer(
  originalSize: number,
  candidates: (Buffer | null | undefined)[]
): Buffer | null {
  const valid = candidates.filter(
    (b): b is Buffer => b !== null && b !== undefined && b.length > 0 && b.length < originalSize
  );
  if (valid.length === 0) return null;
  return valid.reduce((best, current) => (current.length < best.length ? current : best));
}

function savedEnough(originalSize: number, candidateSize: number, minRatio = 0.97): boolean {
  return candidateSize > 0 && candidateSize < originalSize * minRatio;
}

export async function compressPDF(
  fileBuffer: Buffer,
  level: "basic" | "strong" = "basic",
  password?: string
): Promise<CompressionResult> {
  const originalSize = fileBuffer.length;

  try {
    const structural = await compressStructurally(fileBuffer, level);

    // Basic is deliberately lossless. If structural cleanup cannot save at
    // least 3%, return the byte-identical source and report it as optimized.
    // Rasterizing here would destroy searchable text, links, forms and tags.
    if (level === "basic") {
      if (savedEnough(originalSize, structural.length, 0.97)) {
        return {
          buffer: structural,
          originalSize,
          compressedSize: structural.length,
          status: "compressed",
          method: "structural",
        };
      }

      return {
        buffer: fileBuffer,
        originalSize,
        compressedSize: originalSize,
        status: "already-optimized",
        method: "original",
      };
    }

    const pageCount = await countPdfPages(fileBuffer, password);

    let rasterized: Buffer | null = null;
    if (pageCount > 0) {
      try {
        const plan = resolveCompressRasterPlan(level, pageCount);
        rasterized = await compressByRasterizing(fileBuffer, plan, password);
      } catch (rasterErr) {
        await logError({
          tool_name: "compress-pdf",
          error_type: "RASTERIZE_ATTEMPT",
          error_message: rasterErr instanceof Error ? rasterErr.message : String(rasterErr),
        }).catch(() => {});
      }
    }

    const best = pickSmallestBuffer(originalSize, [structural, rasterized]);

    if (best && savedEnough(originalSize, best.length, 0.97)) {
      return {
        buffer: best,
        originalSize,
        compressedSize: best.length,
        status: "compressed",
        method: rasterized && best === rasterized ? "rasterized" : "structural",
      };
    }

    return {
      buffer: fileBuffer,
      originalSize,
      compressedSize: originalSize,
      status: "already-optimized",
      method: "original",
    };
  } catch (err) {
    await logError({
      tool_name: "compress-pdf",
      error_type: "COMPRESS_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(
      `Failed to compress PDF: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}

async function countPdfPages(fileBuffer: Buffer, password?: string): Promise<number> {
  const parser = new PDFParse({ data: fileBuffer, password });
  try {
    const info = await parser.getInfo();
    return info.total ?? 0;
  } catch {
    return 0;
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function compressStructurally(
  fileBuffer: Buffer,
  level: "basic" | "strong"
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(fileBuffer, {
    ignoreEncryption: true,
  });

  if (level === "strong") {
    try {
      pdfDoc.getForm().flatten();
    } catch {
      // No form fields to flatten
    }
  }

  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("OnlyMyPDF");
  pdfDoc.setCreator("OnlyMyPDF");

  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: level === "strong" ? 35 : 50,
  });

  return Buffer.from(compressedBytes);
}

async function compressByRasterizing(
  fileBuffer: Buffer,
  plan: RasterPlan,
  password?: string
): Promise<Buffer> {
  const parser = new PDFParse({ data: fileBuffer, password });

  try {
    const info = await parser.getInfo();
    const totalPages = info.total;
    if (totalPages <= 0) {
      throw new Error("Could not read PDF pages for compression.");
    }

    const pdfDoc = await PDFDocument.create();
    const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1);

    for (let i = 0; i < pageNums.length; i += plan.batchSize) {
      const batch = pageNums.slice(i, i + plan.batchSize);
      const shot = await parser.getScreenshot({
        partial: batch,
        desiredWidth: plan.desiredWidth,
        imageBuffer: true,
        imageDataUrl: false,
      });

      const byPage = new Map(shot.pages.map((p) => [p.pageNumber, p]));

      for (const pageNum of batch) {
        const page = byPage.get(pageNum);
        if (!page?.data || !page.width || !page.height) continue;

        const jpeg = await sharp(Buffer.from(page.data))
          .jpeg({ quality: plan.quality, mozjpeg: true })
          .toBuffer();

        const image = await pdfDoc.embedJpg(jpeg);
        // Keep letter-ish page width so raster output stays compact.
        const widthPt = 612;
        const heightPt = (page.height / page.width) * widthPt;
        const pdfPage = pdfDoc.addPage([widthPt, heightPt]);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: widthPt,
          height: heightPt,
        });
      }
    }

    if (pdfDoc.getPageCount() === 0) {
      throw new Error("Rasterization produced no pages.");
    }

    return Buffer.from(
      await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      })
    );
  } finally {
    await parser.destroy();
  }
}
