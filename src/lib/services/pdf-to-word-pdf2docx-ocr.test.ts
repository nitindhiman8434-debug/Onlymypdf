import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execution = vi.hoisted(() => ({ stderr: "" }));
vi.mock("child_process", () => ({
  spawn: (_command: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      kill: () => void;
    };
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    queueMicrotask(() => {
      if (args.includes("--version")) {
        child.emit("close", 0);
      } else {
        child.stderr.emit("data", Buffer.from(execution.stderr));
        child.emit("close", 1);
      }
    });
    return child;
  },
}));

describe("pdf2docx subprocess OCR error transport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PDF2DOCX_PYTHON", "test-python");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["WARN OCR text below gate: chars=0 need=20\nERROR OCR_REQUIRED OCR could not produce editable text\n", 422],
    ["ERROR OCR_REQUIRED Tesseract or requested language data unavailable (eng+hin)\n", 503],
  ] as const)("preserves classified OCR diagnostics from stderr", async (stderr, status) => {
    execution.stderr = stderr;
    const { pdfToWordPdf2docx } = await import("./pdf-to-word-pdf2docx.service");
    await expect(pdfToWordPdf2docx(Buffer.from("synthetic input"))).rejects.toMatchObject({
      name: "PdfToWordOcrError", status,
    });
  });

  it("keeps generic conversion failures unclassified", async () => {
    execution.stderr = "WARN OCR conversion failed: unexpected bug\nERROR OCR_REQUIRED OCR could not produce editable text\n";
    const { pdfToWordPdf2docx } = await import("./pdf-to-word-pdf2docx.service");
    const error = await pdfToWordPdf2docx(Buffer.from("synthetic input")).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("status");
  });
});
