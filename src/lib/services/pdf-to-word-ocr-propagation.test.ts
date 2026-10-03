import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  convert: vi.fn(),
  word: vi.fn(),
  hints: vi.fn(),
}));
vi.mock("@/lib/db/queries", () => ({ logError: vi.fn(async () => undefined) }));
vi.mock("./pdf-to-word-pdf2docx.service", () => ({
  isPdf2docxAvailable: mocks.available,
  pdfToWordPdf2docx: mocks.convert,
}));
vi.mock("./pdf-to-word-convertapi.service", () => ({
  isConvertApiAvailable: () => false,
  pdfToWordConvertApi: vi.fn(),
  pdfToWordConvertApiToPath: vi.fn(),
}));
vi.mock("./pdf-to-word-word-com.service", () => ({
  isWordComPdfImportAvailable: async () => true,
  pdfToWordWordCom: mocks.word,
}));
vi.mock("./pdf-to-word-libreoffice.service", () => ({
  isLibreOfficePdfToDocxAvailable: () => false,
  pdfToWordLibreOffice: vi.fn(),
}));
vi.mock("./pdf-to-word-hints.service", () => ({
  resolvePdfHintsSafe: mocks.hints,
  isDenseEditableForm: () => false,
  isDenseShortDocument: () => false,
  isImageHeavyPdf: () => false,
  isTextRichManual: () => false,
}));
vi.mock("./pdf-to-word-docx-post.service", () => ({
  isDocxConversionAcceptable: async () => true,
  shouldPostProcessDocx: async () => false,
}));
// These unselected fallback engines otherwise load the PDF rendering graph.
// A routing regression must fail explicitly instead of doing real conversion.
vi.mock("./pdf-to-word-node.service", () => ({
  pdfToWordNode: vi.fn(() => { throw new Error("Unexpected Node fallback"); }),
}));
vi.mock("./pdf-to-word-visual.service", () => ({
  pdfToWordVisual: vi.fn(() => { throw new Error("Unexpected visual fallback"); }),
}));

let pdfToWord: typeof import("./pdf-to-word.service").pdfToWord;
let PdfToWordOcrError: typeof import("./pdf-to-word-ocr-error").PdfToWordOcrError;

describe("PDF-to-Word OCR error propagation after engine attempts", () => {
  beforeEach(async () => {
    // The production module caches Python availability, which differs by case.
    vi.resetModules();
    vi.stubEnv("PDF_OCR_REQUIRED", "true");
    vi.stubEnv("PDF_TO_WORD_PREFER_PDF2DOCX", "0");
    mocks.available.mockResolvedValue(true);
    mocks.convert.mockReset();
    mocks.word.mockReset();
    mocks.hints.mockResolvedValue({ pageCount: 1, pdfTextChars: 0, imageOnly: true });
    ({ pdfToWord } = await import("./pdf-to-word.service"));
    ({ PdfToWordOcrError } = await import("./pdf-to-word-ocr-error"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([422, 503] as const)("retains a classified OCR failure (%i)", async (status) => {
    const failure = new PdfToWordOcrError("Specific OCR failure", status);
    mocks.convert.mockRejectedValue(failure);
    await expect(pdfToWord({ buffer: Buffer.from("source") })).rejects.toBe(failure);
    expect(mocks.word).not.toHaveBeenCalled();
  });

  it("reports unavailable infrastructure when no Python converter is available", async () => {
    mocks.available.mockResolvedValue(false);
    await expect(pdfToWord({ buffer: Buffer.from("source") })).rejects.toMatchObject({ status: 503 });
    expect(mocks.convert).not.toHaveBeenCalled();
    expect(mocks.word).not.toHaveBeenCalled();
  });

  it("does not reclassify unexpected converter bugs as unsupported input", async () => {
    mocks.convert.mockRejectedValue(new Error("Unexpected internal failure"));
    const failure = await pdfToWord({ buffer: Buffer.from("source") }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(PdfToWordOcrError);
  });

  it("leaves a successful OCR conversion unchanged", async () => {
    const output = Buffer.from("verified DOCX bytes");
    mocks.convert.mockResolvedValue(output);
    await expect(pdfToWord({ buffer: Buffer.from("source") })).resolves.toMatchObject({
      buffer: output, engine: "pdf2docx",
    });
  });

  it("uses the opt-in local Python engine for selectable PDFs even when COM is available", async () => {
    vi.stubEnv("PDF_TO_WORD_PREFER_PDF2DOCX", "1");
    mocks.hints.mockResolvedValue({ pageCount: 1, pdfTextChars: 200, imageOnly: false });
    const output = Buffer.from("verified selectable DOCX bytes");
    mocks.convert.mockResolvedValue(output);
    await expect(pdfToWord({ buffer: Buffer.from("source") })).resolves.toMatchObject({ buffer: output, engine: "pdf2docx" });
    expect(mocks.word).not.toHaveBeenCalled();
  });

  it("fails closed for selectable PDFs when the pinned local engine is missing", async () => {
    vi.stubEnv("PDF_TO_WORD_PREFER_PDF2DOCX", "1");
    mocks.available.mockResolvedValue(false);
    mocks.hints.mockResolvedValue({ pageCount: 1, pdfTextChars: 200, imageOnly: false });
    await expect(pdfToWord({ buffer: Buffer.from("source") })).rejects.toMatchObject({ name: "ConversionRuntimeUnavailableError" });
    expect(mocks.word).not.toHaveBeenCalled();
  });
});
