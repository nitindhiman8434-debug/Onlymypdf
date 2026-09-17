import fs from "fs/promises";
import { logError } from "@/lib/db/queries";
import {
  isConvertApiAvailable,
  pdfToWordConvertApi,
  pdfToWordConvertApiToPath,
} from "@/lib/services/pdf-to-word-convertapi.service";
import {
  isConvertApiOnlyMode,
  resolveConversionStrategy,
} from "@/lib/services/pdf-to-word-engine-plan";
import {
  canTrustEngineOutputWithoutFullScan,
  isDocxConversionAcceptable,
  isDocxFileBasicallyValid,
  postProcessDocx,
  shouldPostProcessDocx,
} from "@/lib/services/pdf-to-word-docx-post.service";
import {
  isLibreOfficePdfToDocxAvailable,
  pdfToWordLibreOffice,
} from "@/lib/services/pdf-to-word-libreoffice.service";
import {
  isPdf2docxAvailable,
  pdfToWordPdf2docx,
} from "@/lib/services/pdf-to-word-pdf2docx.service";
import { pdfToWordNode } from "@/lib/services/pdf-to-word-node.service";
import { pdfToWordVisual } from "@/lib/services/pdf-to-word-visual.service";
import { pdfToWordWordCom, isWordComPdfImportAvailable } from "@/lib/services/pdf-to-word-word-com.service";
import {
  resolvePdfHintsSafe,
  isTextRichManual,
} from "@/lib/services/pdf-to-word-hints.service";

export type { PdfToWordEngine } from "@/lib/services/pdf-to-word-engine-plan";
import type { PdfToWordEngine } from "@/lib/services/pdf-to-word-engine-plan";

let pdf2docxReadyCache: boolean | null = null;

function estimateTimeoutMs(byteLength: number): number {
  const sizeMb = byteLength / (1024 * 1024);
  return Math.min(1_800_000, Math.max(900_000, 120_000 + Math.ceil(sizeMb) * 120_000));
}

/** Slowly tick progress while a long engine runs so the UI does not look frozen. */
function startProgressHeartbeat(
  onProgress: ((percent: number) => void) | undefined,
  start: number,
  cap: number,
  intervalMs = 4000
): () => void {
  if (!onProgress) return () => undefined;
  let current = start;
  const timer = setInterval(() => {
    if (current < cap - 1) {
      current += 1;
      onProgress(current);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

export function mapPdfToWordError(message: string): string {
  if (message === "PASSWORD_REQUIRED" || message.includes("PASSWORD_REQUIRED")) {
    return "PASSWORD_REQUIRED";
  }
  if (message === "WRONG_PASSWORD" || /incorrect password/i.test(message)) {
    return "WRONG_PASSWORD";
  }
  if (/document closed or encrypted/i.test(message)) {
    return "This PDF is locked. Use Unlock PDF first, or enter the correct password.";
  }
  if (
    /ENOENT|EACCES|EPERM|no such file|not produce a Word file|produced no output/i.test(
      message
    )
  ) {
    return "Conversion did not produce a Word file. Please try again or use a different PDF.";
  }
  return message.replace(/^ERROR PASSWORD_REQUIRED\s*/i, "").replace(/^ERROR\s*/i, "").trim();
}

export type PdfToWordResult = {
  buffer?: Buffer;
  outputPath?: string;
  engine: PdfToWordEngine;
};

type PdfToWordOptions = {
  fileName?: string;
  onProgress?: (percent: number) => void;
  inputPath?: string;
  outputPath?: string;
  pdfPassword?: string;
  buffer?: Buffer;
};

type QualityHints = {
  pageCount?: number;
  pdfTextChars?: number;
  byteLength?: number;
  hybridScanned?: boolean;
};

async function finalizeDocxResult(
  engine: PdfToWordEngine,
  raw: Buffer | undefined,
  options: {
    diskOnly: boolean;
    outputPath?: string;
    hints: QualityHints;
    onProgress?: (percent: number) => void;
  }
): Promise<PdfToWordResult | null> {
  const docx = raw;
  if (!docx?.length) return null;
  options.onProgress?.(97);

  if (
    options.hints.hybridScanned &&
    engine === "word-com" &&
    options.hints.byteLength &&
    docx.length < options.hints.byteLength * 0.05
  ) {
    console.warn("[pdf-to-word] word-com output too small for hybrid scanned PDF (figures lost)");
    return null;
  }

  if (!(await isDocxConversionAcceptable(docx, options.hints).catch(() => false))) {
    console.warn(`[pdf-to-word] ${engine} output failed quality check`);
    return null;
  }

  const processed =
    engine === "word-com" ||
    engine === "convertapi" ||
    engine === "pdf2docx" ||
    !(await shouldPostProcessDocx(docx))
      ? docx
      : await postProcessDocx(docx);
  options.onProgress?.(99);
  if (options.diskOnly && options.outputPath) {
    await fs.writeFile(options.outputPath, processed);
    return { outputPath: options.outputPath, engine };
  }
  return { buffer: processed, engine };
}

async function outputFileReady(outputPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(outputPath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function finalizeDiskPathResult(
  engine: PdfToWordEngine,
  outputPath: string,
  hints: QualityHints,
  onProgress?: (percent: number) => void
): Promise<PdfToWordResult | null> {
  if (!(await outputFileReady(outputPath))) return null;

  if (canTrustEngineOutputWithoutFullScan(engine)) {
    onProgress?.(96);
    if (!(await isDocxFileBasicallyValid(outputPath))) return null;
    onProgress?.(99);
    return { outputPath, engine };
  }

  onProgress?.(94);
  let docx: Buffer;
  try {
    docx = await fs.readFile(outputPath);
  } catch {
    return null;
  }
  onProgress?.(96);
  return finalizeDocxResult(engine, docx, {
    diskOnly: true,
    outputPath,
    hints,
    onProgress,
  });
}

async function resolveHints(
  inputPath: string | undefined,
  buffer: Buffer | undefined,
  byteLength: number
): Promise<QualityHints> {
  return resolvePdfHintsSafe({ inputPath, buffer, byteLength });
}

/**
 * PDF → Word with engine priority (professional-grade quality):
 * 1. ConvertAPI (commercial, if CONVERTAPI_SECRET set)
 * 2. Windows: Word COM → pdf2docx → LibreOffice (LO PDF import often hangs)
 *    Linux:  LibreOffice → pdf2docx → Word COM (N/A on Linux)
 * 3. Visual page render (exact layout, non-editable text)
 * 4. Node text extractor (last resort, small PDFs only)
 */
export async function pdfToWord(options: PdfToWordOptions): Promise<PdfToWordResult> {
  const fileName = options.fileName ?? "document.pdf";
  const onProgress = options.onProgress;
  const diskOnly = Boolean(options.outputPath);

  let byteLength = options.buffer?.length ?? 0;
  if (options.inputPath) {
    try {
      const stat = await fs.stat(options.inputPath);
      byteLength = stat.size;
    } catch {
      throw new Error("PDF input is missing. Please upload the file again.");
    }
  }
  if (byteLength === 0) {
    throw new Error("PDF input is empty");
  }

  const timeoutMs = estimateTimeoutMs(byteLength);
  // Only treat truly huge PDFs as "large" (disables the render/text fallbacks).
  // Below this, the visual + node fallbacks stay available so a result is always
  // produced even when LibreOffice/pdf2docx are slow or reject the output.
  const largePdf = byteLength > 40 * 1024 * 1024;
  // LibreOffice PDF import often hangs on complex files — cap aggressively so
  // faster engines (Word COM / pdf2docx / visual) get a turn.
  const libreOfficePdfTimeoutMs = Math.min(timeoutMs, 90_000);
  const officeTimeoutMs = Math.min(timeoutMs, 300_000);

  if (pdf2docxReadyCache === null) {
    pdf2docxReadyCache = await isPdf2docxAvailable();
  }
  const pdf2docxReady = pdf2docxReadyCache;
  const libreOfficeReady = isLibreOfficePdfToDocxAvailable();
  const wordComReady = await isWordComPdfImportAvailable();

  let cachedBuffer: Buffer | null = options.buffer?.length ? options.buffer : null;

  async function loadBuffer(): Promise<Buffer> {
    if (cachedBuffer) return cachedBuffer;
    if (options.inputPath) {
      cachedBuffer = await fs.readFile(options.inputPath);
      return cachedBuffer;
    }
    throw new Error("PDF input is required");
  }

  const hints = await resolveHints(options.inputPath, options.buffer, byteLength);
  const textRichManual = isTextRichManual(hints, byteLength);
  const hybridScanned = hints.hybridScanned ?? false;
  const wordComTimeoutMs = Math.min(
    officeTimeoutMs,
    Math.max(120_000, (hints.pageCount ?? Math.ceil(byteLength / (350 * 1024))) * 15_000)
  );

  async function tryConvertApi(): Promise<PdfToWordResult | null> {
    if (!isConvertApiAvailable()) return null;
    try {
      onProgress?.(5);
      if (diskOnly && options.inputPath && options.outputPath) {
        await pdfToWordConvertApiToPath(options.inputPath, options.outputPath, fileName);
        onProgress?.(95);
        return finalizeDiskPathResult("convertapi", options.outputPath, hints, onProgress);
      }
      const buffer = await loadBuffer();
      const apiBuffer = await pdfToWordConvertApi(buffer, fileName);
      onProgress?.(95);
      return finalizeDocxResult("convertapi", apiBuffer, {
        diskOnly,
        outputPath: options.outputPath,
        hints,
        onProgress,
      });
    } catch (err) {
      console.warn("[pdf-to-word] ConvertAPI failed:", err);
      return null;
    }
  }

  async function tryWordCom(): Promise<PdfToWordResult | null> {
    if (!(await isWordComPdfImportAvailable())) return null;
    const stopHeartbeat = startProgressHeartbeat(onProgress, 8, 88);
    try {
      onProgress?.(8);
      const buffer = options.inputPath ? Buffer.alloc(0) : await loadBuffer();
      const result = await pdfToWordWordCom(buffer, {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        timeoutMs: wordComTimeoutMs,
      });
      onProgress?.(92);
      if (diskOnly && options.outputPath) {
        return finalizeDiskPathResult("word-com", options.outputPath, hints, onProgress);
      }
      return finalizeDocxResult("word-com", result as Buffer | undefined, {
        diskOnly,
        outputPath: options.outputPath,
        hints,
      });
    } catch (err) {
      console.warn("[pdf-to-word] Word COM failed:", err);
      return null;
    } finally {
      stopHeartbeat();
    }
  }

  async function tryLibreOffice(): Promise<PdfToWordResult | null> {
    if (!libreOfficeReady) return null;
    const stopHeartbeat = startProgressHeartbeat(onProgress, 10, 88);
    try {
      onProgress?.(10);
      const buffer = options.inputPath ? Buffer.alloc(0) : await loadBuffer();
      const result = await pdfToWordLibreOffice(buffer, {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        timeoutMs: libreOfficePdfTimeoutMs,
      });
      onProgress?.(92);
      if (diskOnly && options.outputPath) {
        return finalizeDiskPathResult("libreoffice", options.outputPath, hints, onProgress);
      }
      return finalizeDocxResult("libreoffice", result as Buffer | undefined, {
        diskOnly,
        outputPath: options.outputPath,
        hints,
      });
    } catch (err) {
      console.warn("[pdf-to-word] LibreOffice failed:", err);
      return null;
    } finally {
      stopHeartbeat();
    }
  }

  async function tryPdf2docx(): Promise<PdfToWordResult | null> {
    if (!pdf2docxReady) return null;
    const stopHeartbeat = startProgressHeartbeat(onProgress, 12, 90);
    try {
      onProgress?.(12);
      const buffer = options.inputPath ? Buffer.alloc(0) : await loadBuffer();
      const pages = hints.pageCount ?? Math.ceil(byteLength / (350 * 1024));
      const perPageMs = textRichManual ? 15_000 : hybridScanned ? 12_000 : 8_000;
      const pdf2docxFloorMs = textRichManual || hybridScanned ? 600_000 : 180_000;
      const pdf2docxTimeoutMs = Math.min(timeoutMs, Math.max(pdf2docxFloorMs, pages * perPageMs));
      const result = await pdfToWordPdf2docx(buffer, {
        timeoutMs: pdf2docxTimeoutMs,
        onProgress,
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        pdfPassword: options.pdfPassword,
      });
      onProgress?.(95);
      if (diskOnly && options.outputPath) {
        return finalizeDiskPathResult("pdf2docx", options.outputPath, hints, onProgress);
      }
      return finalizeDocxResult("pdf2docx", result as Buffer | undefined, {
        diskOnly,
        outputPath: options.outputPath,
        hints,
        onProgress,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[pdf-to-word] pdf2docx failed:", message);
      await logError({
        tool_name: "pdf-to-word",
        error_type: "PDF2DOCX_FAILED",
        error_message: message,
        stack_trace: err instanceof Error ? err.stack : undefined,
      }).catch(() => {});
      return null;
    } finally {
      stopHeartbeat();
    }
  }

  async function tryVisual(): Promise<PdfToWordResult | null> {
    if (largePdf) return null;
    try {
      onProgress?.(15);
      console.warn("[pdf-to-word] Using visual page render fallback");
      const buffer = await loadBuffer();
      const visualBuffer = await pdfToWordVisual(buffer);
      onProgress?.(95);
      if (diskOnly && options.outputPath) {
        await fs.writeFile(options.outputPath, visualBuffer);
        return { outputPath: options.outputPath, engine: "visual" };
      }
      return { buffer: visualBuffer, engine: "visual" };
    } catch (err) {
      console.warn("[pdf-to-word] Visual fallback failed:", err);
      return null;
    }
  }

  async function tryNode(): Promise<PdfToWordResult | null> {
    if (largePdf) return null;
    try {
      console.warn("[pdf-to-word] Using basic Node text extractor (last resort)");
      const buffer = await loadBuffer();
      const nodeBuffer = await pdfToWordNode(buffer);
      onProgress?.(95);
      if (diskOnly && options.outputPath) {
        await fs.writeFile(options.outputPath, nodeBuffer);
        return { outputPath: options.outputPath, engine: "node" };
      }
      return { buffer: nodeBuffer, engine: "node" };
    } catch (err) {
      console.warn("[pdf-to-word] Node extractor failed:", err);
      return null;
    }
  }

  const engineAttempts: Record<PdfToWordEngine, () => Promise<PdfToWordResult | null>> = {
    convertapi: tryConvertApi,
    "word-com": tryWordCom,
    pdf2docx: tryPdf2docx,
    libreoffice: tryLibreOffice,
    visual: tryVisual,
    node: tryNode,
  };

  const strategy = resolveConversionStrategy({
    platform: process.platform,
    convertApiAvailable: isConvertApiAvailable(),
    convertApiOnly: isConvertApiOnlyMode(),
    textRichManual,
    hybridScanned,
    largePdf,
    pdf2docxReady,
    wordComReady,
  });

  for (const engine of [...strategy.engines, ...strategy.emergency]) {
    const attempt = engineAttempts[engine];
    const result = await attempt();
    if (result) {
      onProgress?.(99);
      return result;
    }
  }

  await logError({
    tool_name: "pdf-to-word",
    error_type: "PDF_TO_WORD_FAILED",
    error_message: "All conversion engines failed",
  }).catch(() => {});

  if (largePdf) {
    throw new Error(
      "Conversion failed for this large PDF. Install LibreOffice or pdf2docx on the server, or set CONVERTAPI_SECRET."
    );
  }

  throw new Error(
    "Failed to convert PDF to Word. On Windows install Microsoft Word; on servers install LibreOffice or run scripts/setup-pdf2docx.ps1."
  );
}
