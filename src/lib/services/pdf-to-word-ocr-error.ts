/** Keep scan input failures distinct from unavailable OCR infrastructure. */
export class PdfToWordOcrError extends Error {
  constructor(message: string, readonly status: 422 | 503) {
    super(message);
    this.name = "PdfToWordOcrError";
  }
}

export function unavailablePdfToWordOcr(): PdfToWordOcrError {
  return new PdfToWordOcrError(
    "PDF OCR is temporarily unavailable. Please try again later.",
    503
  );
}

/** Interpret only explicit converter diagnostics, not a generic OCR failure. */
export function pdfToWordOcrErrorFromStderr(stderr: string): PdfToWordOcrError | null {
  if (/^ERROR OCR_REQUIRED (?:Tesseract or requested language data unavailable|OCR language configuration invalid)/m.test(stderr)) {
    return unavailablePdfToWordOcr();
  }
  if (/^ERROR OCR_REQUIRED page limit exceeded\s*$/m.test(stderr)) {
    return new PdfToWordOcrError(
      "This scan exceeds the OCR page limit. Split the PDF into smaller files and try again.",
      422
    );
  }
  if (
    /^ERROR OCR_REQUIRED OCR could not produce editable text\s*$/m.test(stderr) &&
    /^WARN OCR text below gate: chars=\d+ need=\d+\s*$/m.test(stderr) &&
    !/^WARN OCR conversion failed:/m.test(stderr)
  ) {
    return new PdfToWordOcrError(
      "PDF OCR could not extract enough readable text. Try a clearer scan or supported OCR language.",
      422
    );
  }
  return null;
}
