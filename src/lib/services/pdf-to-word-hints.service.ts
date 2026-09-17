import { PDFDocument } from "pdf-lib";

export type PdfHintProfile = {
  pageCount?: number;
  pdfTextChars?: number;
};

/** Manuals / datasheets: dense text across many pages (register maps, specs). */
export function isTextRichManual(hints: PdfHintProfile, byteLength: number): boolean {
  const pages = hints.pageCount ?? 0;
  if (pages < 12) return false;

  const chars = hints.pdfTextChars ?? 0;
  if (chars >= 10_000) return true;

  // pdf-parse can hang on large manuals — fallback heuristic for dense docs.
  if (pages >= 20 && byteLength >= 350_000) {
    const charsPerPage = chars > 0 ? chars / pages : 0;
    if (chars > 0 && charsPerPage < 400) return false;
    if (byteLength > 5_000_000 && chars < 5_000) return false;
    return true;
  }

  return false;
}

/** Score extracted text completeness vs source PDF (higher = more complete). */
export function scoreTextCompleteness(
  docxChars: number,
  hints: PdfHintProfile,
  tables = 0
): number {
  const pages = Math.max(1, hints.pageCount ?? 1);
  const target = hints.pdfTextChars ?? pages * 900;
  const ratio = Math.min(docxChars, target) / Math.max(target, 1);
  return ratio + Math.min(tables, 500) * 0.001;
}

const HINTS_TIMEOUT_MS = 8_000;

/** Instant hints from file size — fallback when PDF read is skipped. */
export function estimatePdfHintsFromStat(byteLength: number): PdfHintProfile {
  const pageCount = Math.max(1, Math.round(byteLength / 11_000));
  return { pageCount, pdfTextChars: undefined };
}

/** Design posters / scanned PDFs: large bytes, few pages, little extractable text. */
export function isImageHeavyPdf(hints: PdfHintProfile, byteLength: number): boolean {
  const pages = Math.max(1, hints.pageCount ?? 1);
  const bytesPerPage = byteLength / pages;
  const textChars = hints.pdfTextChars ?? 0;
  const charsPerPage = textChars > 0 ? textChars / pages : 0;
  return bytesPerPage > 150_000 && (textChars === 0 || charsPerPage < 800);
}

/**
 * Hybrid scanned PDF: full-page background images with an OCR/text overlay.
 * Word COM destroys figure images; route to pdf2docx / ConvertAPI instead.
 */
export function isHybridScannedPdf(hints: PdfHintProfile, byteLength: number): boolean {
  if (isImageHeavyPdf(hints, byteLength)) return false;

  const pages = Math.max(1, hints.pageCount ?? 1);
  const bytesPerPage = byteLength / pages;
  const textChars = hints.pdfTextChars ?? 0;

  if (textChars < 2_000 || pages > 40) return false;

  // e.g. 32460-001.pdf: 6 pages, ~10 MB, ~28k text — large page rasters + text layer
  return bytesPerPage >= 400_000 && pages <= 30;
}

const MAX_HINTS_READ_BYTES = 50 * 1024 * 1024;

/** Accurate page count from disk — one bounded read (fixes image-heavy poster routing). */
export async function estimatePdfHintsFromPath(
  inputPath: string,
  byteLength?: number
): Promise<PdfHintProfile> {
  const { readFile, stat } = await import("fs/promises");
  let size = byteLength;
  if (size == null) {
    size = (await stat(inputPath)).size;
  }
  if (size <= MAX_HINTS_READ_BYTES) {
    try {
      const data = await readFile(inputPath);
      return estimatePdfHintsFast(data);
    } catch {
      return estimatePdfHintsFromStat(size);
    }
  }
  return estimatePdfHintsFromStat(size);
}

export type ResolvedPdfHints = PdfHintProfile & {
  byteLength: number;
  hybridScanned: boolean;
};

/**
 * Never throws — used only by pdf-to-word. Other tools must not import this.
 * On failure, falls back to size-based hints and disables hybrid routing.
 */
export async function resolvePdfHintsSafe(input: {
  inputPath?: string;
  buffer?: Buffer;
  byteLength: number;
}): Promise<ResolvedPdfHints> {
  const byteLength = Math.max(0, input.byteLength);
  if (byteLength === 0) {
    return { byteLength: 0, hybridScanned: false, pageCount: 1 };
  }

  try {
    if (input.inputPath) {
      const hints = await estimatePdfHintsFromPath(input.inputPath, byteLength);
      return {
        ...hints,
        byteLength,
        hybridScanned: isHybridScannedPdf(hints, byteLength),
      };
    }
    if (input.buffer?.length) {
      const hints = await estimatePdfHintsFromBuffer(input.buffer);
      return {
        ...hints,
        byteLength: input.buffer.length,
        hybridScanned: isHybridScannedPdf(hints, input.buffer.length),
      };
    }
  } catch (err) {
    console.warn("[pdf-to-word] hint resolution failed, using safe fallback:", err);
  }

  const fallback = estimatePdfHintsFromStat(byteLength);
  return {
    ...fallback,
    byteLength,
    hybridScanned: false,
  };
}

/** Hints when PDF bytes are already in memory (sync upload path). */
export async function estimatePdfHintsFromBuffer(data: Buffer): Promise<PdfHintProfile> {
  return estimatePdfHintsFast(data);
}

/** Fast page count via pdf-lib; optional bounded text sample via pdf-parse. */
export async function estimatePdfHintsFast(
  data: Buffer
): Promise<PdfHintProfile> {
  let pageCount: number | undefined;
  try {
    const pdf = await PDFDocument.load(data, { ignoreEncryption: true });
    pageCount = pdf.getPageCount();
  } catch {
    pageCount = undefined;
  }

  if (!pageCount) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data });
      try {
        const info = await Promise.race([
          parser.getInfo(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("hint timeout")), HINTS_TIMEOUT_MS)
          ),
        ]);
        pageCount = info.total || undefined;
      } finally {
        await parser.destroy();
      }
    } catch {
      pageCount = undefined;
    }
  }

  if (!pageCount) {
    pageCount = Math.max(1, Math.round(data.length / 11_000));
  }

  let pdfTextChars: number | undefined;
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data });
    const sample = await Promise.race([
      (async () => {
        try {
          const text = await parser.getText({ partial: [1, 2, 3, 4, 5] });
          const chars = text.text?.replace(/\s+/g, " ").trim().length ?? 0;
          if (pageCount && pageCount > 5 && chars > 0) {
            return Math.round(chars * (pageCount / 5) * 0.92);
          }
          return chars;
        } finally {
          await parser.destroy();
        }
      })(),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error("hint timeout")), HINTS_TIMEOUT_MS)
      ),
    ]);
    pdfTextChars = sample;
  } catch {
    pdfTextChars = undefined;
  }

  return { pageCount, pdfTextChars };
}
