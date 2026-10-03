import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversionRuntimeUnavailableError, UnsupportedConversionInputError } from "./conversion-input-error";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), python: vi.fn() }));
vi.mock("node:util", async (original) => ({
  ...await original<typeof import("node:util")>(),
  promisify: () => mocks.execute,
}));
vi.mock("./pdf-to-word-pdf2docx.service", () => ({ resolvePdf2docxPython: mocks.python }));
import { runAdvancedPdfTool } from "./advanced-pdf-tools.service";

describe("advanced PDF tool OCR error classification", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.python.mockResolvedValue("test-python");
  });

  it("classifies missing Python as service unavailable", async () => {
    mocks.python.mockResolvedValue(null);
    await expect(runAdvancedPdfTool({ operation: "ocr", source: Buffer.from("PDF") }))
      .rejects.toBeInstanceOf(ConversionRuntimeUnavailableError);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("classifies missing engine or language packs as service unavailable", async () => {
    mocks.execute.mockRejectedValue({ stdout: JSON.stringify({ error: "OCR engine or requested language data is unavailable (eng+hin)" }) });
    await expect(runAdvancedPdfTool({ operation: "ocr", source: Buffer.from("PDF") }))
      .rejects.toBeInstanceOf(ConversionRuntimeUnavailableError);
  });

  it("classifies unreadable raster content as unsupported input", async () => {
    mocks.execute.mockRejectedValue({ stdout: JSON.stringify({ error: "OCR engine could not recognize readable text on page 2. Try a clearer scan or another supported language." }) });
    await expect(runAdvancedPdfTool({ operation: "ocr", source: Buffer.from("PDF") }))
      .rejects.toBeInstanceOf(UnsupportedConversionInputError);
  });

  it("does not classify arbitrary OCR exceptions as input failures", async () => {
    mocks.execute.mockRejectedValue({ stdout: JSON.stringify({ error: "OCR engine unexpected internal bug" }) });
    const error = await runAdvancedPdfTool({ operation: "ocr", source: Buffer.from("PDF") }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnsupportedConversionInputError);
    expect(error).not.toBeInstanceOf(ConversionRuntimeUnavailableError);
  });
});
