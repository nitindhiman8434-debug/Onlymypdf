export type PdfToWordEngine =
  | "convertapi"
  | "word-com"
  | "libreoffice"
  | "pdf2docx"
  | "reference-transcript"
  | "visual"
  | "node";

export type PdfToWordEnginePlanInput = {
  platform: NodeJS.Platform;
  convertApiAvailable: boolean;
  convertApiOnly: boolean;
  textRichManual?: boolean;
  denseEditableForm?: boolean;
  imageOnly?: boolean;
  ocrRequired?: boolean;
  hybridScanned?: boolean;
  largePdf?: boolean;
  pdf2docxReady?: boolean;
  wordComReady?: boolean;
};

export type ConversionStrategy = {
  /** Primary + at most one fallback — no 6-engine sequential chains. */
  engines: PdfToWordEngine[];
  /** Last-resort engines only when primary path fails (small PDFs). */
  emergency: PdfToWordEngine[];
};

export function isConvertApiOnlyMode(): boolean {
  return process.env.PDF_TO_WORD_CONVERTAPI_ONLY === "1";
}

/**
 * Pick the smallest fast path for this PDF type.
 * Production: ConvertAPI → pdf2docx fallback.
 * Windows dev: word-com (design) OR pdf2docx (manuals).
 */
export function resolveConversionStrategy(input: PdfToWordEnginePlanInput): ConversionStrategy {
  const emergency: PdfToWordEngine[] = input.largePdf || (input.ocrRequired && input.imageOnly)
    ? [] : ["visual", "node"];

  if (input.convertApiAvailable && input.convertApiOnly) {
    const engines: PdfToWordEngine[] = ["convertapi"];
    if (input.pdf2docxReady) engines.push("pdf2docx");
    return { engines, emergency };
  }

  if (input.denseEditableForm) {
    const engines: PdfToWordEngine[] = [];
    if (input.convertApiAvailable) engines.push("convertapi");
    if (input.pdf2docxReady) engines.push("reference-transcript");
    // A failed form conversion should still offer editable text, not a silent
    // full-page image DOCX that claims to be editable.
    return engines.length
      ? { engines, emergency: input.largePdf ? [] : ["node"] }
      : { engines: input.largePdf ? [] : ["node"], emergency: [] };
  }

  // Hybrid scanned journals: preserve full-page figures — never Word COM first.
  if (input.hybridScanned) {
    const engines: PdfToWordEngine[] = [];
    if (input.convertApiAvailable) engines.push("convertapi");
    if (input.pdf2docxReady) engines.push("pdf2docx");
    if (input.wordComReady) engines.push("word-com");
    const hybridEmergency: PdfToWordEngine[] = input.largePdf || (input.ocrRequired && input.imageOnly)
      ? [] : ["visual"];
    return { engines: engines.length ? engines : ["pdf2docx"], emergency: hybridEmergency };
  }

  if (input.convertApiAvailable) {
    const engines: PdfToWordEngine[] = ["convertapi"];
    if (input.textRichManual && input.pdf2docxReady) {
      engines.push("pdf2docx");
    } else if (input.wordComReady) {
      engines.push("word-com");
    } else if (input.pdf2docxReady) {
      engines.push("pdf2docx");
    }
    return { engines, emergency };
  }

  if (input.textRichManual) {
    const engines: PdfToWordEngine[] = [];
    if (input.pdf2docxReady) engines.push("pdf2docx");
    if (input.wordComReady) engines.push("word-com");
    return { engines: engines.length ? engines : ["pdf2docx"], emergency };
  }

  if (input.platform === "win32") {
    const engines: PdfToWordEngine[] = [];
    if (input.wordComReady) engines.push("word-com");
    if (input.pdf2docxReady) engines.push("pdf2docx");
    return { engines: engines.length ? engines : ["pdf2docx"], emergency };
  }

  const engines: PdfToWordEngine[] = [];
  if (input.pdf2docxReady) engines.push("pdf2docx");
  engines.push("libreoffice");
  return { engines, emergency };
}

/** @deprecated Use resolveConversionStrategy — kept for tests. */
export function resolvePdfToWordEngineOrder(input: PdfToWordEnginePlanInput): PdfToWordEngine[] {
  const strategy = resolveConversionStrategy(input);
  return [...strategy.engines, ...strategy.emergency];
}
