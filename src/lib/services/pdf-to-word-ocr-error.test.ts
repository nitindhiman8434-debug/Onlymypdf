import { describe, expect, it } from "vitest";
import { pdfToWordOcrErrorFromStderr } from "./pdf-to-word-ocr-error";

describe("PDF-to-Word OCR diagnostics", () => {
  it("classifies verified unreadable content as unsupported input", () => {
    const error = pdfToWordOcrErrorFromStderr(
      "WARN OCR text below gate: chars=0 need=20\nERROR OCR_REQUIRED OCR could not produce editable text\n"
    );
    expect(error?.status).toBe(422);
    expect(error?.message).toContain("clearer scan");
  });

  it("does not blame the input for an unexpected converter exception", () => {
    expect(pdfToWordOcrErrorFromStderr(
      "WARN OCR conversion failed: unexpected internal failure\nERROR OCR_REQUIRED OCR could not produce editable text\n"
    )).toBeNull();
    expect(pdfToWordOcrErrorFromStderr(
      "ERROR OCR_REQUIRED OCR could not produce editable text\n"
    )).toBeNull();
  });

  it.each([
    "Tesseract or requested language data unavailable (eng+hin)",
    "OCR language configuration invalid",
  ])("classifies infrastructure/configuration failure as unavailable: %s", (reason) => {
    expect(pdfToWordOcrErrorFromStderr(`ERROR OCR_REQUIRED ${reason}\n`)?.status).toBe(503);
  });

  it("classifies the configured OCR page ceiling as unsupported input", () => {
    const error = pdfToWordOcrErrorFromStderr("ERROR OCR_REQUIRED page limit exceeded\n");
    expect(error?.status).toBe(422);
    expect(error?.message).toContain("Split the PDF");
  });

  it.each(["ERROR PASSWORD_REQUIRED", "WRONG_PASSWORD", "RuntimeError: broken converter"])(
    "leaves unrelated errors unchanged: %s",
    (message) => expect(pdfToWordOcrErrorFromStderr(message)).toBeNull()
  );
});
