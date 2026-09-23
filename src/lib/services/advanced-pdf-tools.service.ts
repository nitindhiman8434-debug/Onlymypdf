import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { UnsupportedConversionInputError } from "@/lib/services/conversion-input-error";
import { resolvePdf2docxPython } from "@/lib/services/pdf-to-word-pdf2docx.service";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "pdf-advanced-tools.py");
const MAX_TIMEOUT_MS = 15 * 60_000;

export type AdvancedPdfOperation =
  | "repair"
  | "ocr"
  | "redact"
  | "crop"
  | "compare"
  | "pdfa";

export interface AdvancedPdfResult {
  output: Buffer;
  details: Record<string, unknown>;
}

function parseLastJsonLine(value: string): Record<string, unknown> {
  const lines = value.trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    const candidate = line.trim();
    if (!candidate.startsWith("{")) continue;
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      // Continue to the preceding line.
    }
  }
  return {};
}

function cleanScriptError(stdout: string, stderr: string, fallback: string): Error {
  const parsed = parseLastJsonLine(`${stdout}\n${stderr}`);
  const message = typeof parsed.error === "string" && parsed.error.trim()
    ? parsed.error.trim()
    : fallback;
  if (
    /OCR supports|OCR engine|No matching text|damaged beyond safe recovery|requires Ghostscript|contains no pages/i.test(
      message
    )
  ) {
    return new UnsupportedConversionInputError(message);
  }
  return new Error(message);
}

export async function runAdvancedPdfTool(input: {
  operation: AdvancedPdfOperation;
  source: Buffer;
  options?: Record<string, unknown>;
  secondSource?: Buffer;
}): Promise<AdvancedPdfResult> {
  const python = await resolvePdf2docxPython();
  if (!python) {
    throw new UnsupportedConversionInputError(
      "PDF processing runtime is unavailable. Please try again later."
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `onlymypdf-${input.operation}-`));
  const sourcePath = path.join(tempDir, "input.pdf");
  const secondPath = path.join(tempDir, "second.pdf");
  const outputPath = path.join(tempDir, "output.pdf");

  try {
    await fs.writeFile(sourcePath, input.source);
    if (input.secondSource) await fs.writeFile(secondPath, input.secondSource);

    const args = [
      SCRIPT_PATH,
      input.operation,
      sourcePath,
      outputPath,
      JSON.stringify(input.options ?? {}),
    ];
    if (input.secondSource) args.push("--second", secondPath);

    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(python, args, {
        timeout: MAX_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          OPENBLAS_NUM_THREADS: "1",
          OMP_NUM_THREADS: "1",
        },
      });
      stdout = result.stdout;
      stderr = result.stderr ?? "";
    } catch (error) {
      const executionError = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      throw cleanScriptError(
        executionError.stdout ?? stdout,
        executionError.stderr ?? stderr,
        executionError.message ?? "PDF processing failed"
      );
    }

    const details = parseLastJsonLine(stdout);
    if (typeof details.error === "string") {
      throw cleanScriptError(stdout, stderr, details.error);
    }
    const output = await fs.readFile(outputPath);
    if (output.length < 5 || output.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("PDF processing produced an invalid output file");
    }
    return { output, details };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
