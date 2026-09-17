import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logError } from "@/lib/db/queries";
import { resolvePdf2docxPython } from "@/lib/services/pdf-to-word-pdf2docx.service";
import {
  isConvertApiPptAvailable,
  pdfToPptConvertApi,
} from "@/lib/services/pdf-to-ppt-convertapi.service";

const execFileAsync = promisify(execFile);

const BUILD_SCRIPT = path.join(process.cwd(), "scripts", "pdf-to-ppt-build.py");
const MAX_CONVERSION_TIMEOUT_MS = 720_000;

interface BuildScriptResult {
  pageCount?: number;
  editableSlides?: number;
  targetWidth?: number;
  outputPath?: string;
  error?: string;
}

function parseScriptJson(stdout: string): BuildScriptResult {
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed) as BuildScriptResult;
    }
  }
  throw new Error("No JSON output from PPT build script");
}

async function pdfToPptLocal(fileBuffer: Buffer): Promise<Buffer> {
  const python = (await resolvePdf2docxPython()) ?? "python";
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-doctor-ppt-build-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const slidesDir = path.join(tmpDir, "slides");
  const pptxPath = path.join(tmpDir, "output.pptx");

  try {
    await fs.writeFile(pdfPath, fileBuffer);
    await fs.mkdir(slidesDir, { recursive: true });

    const { stdout } = await execFileAsync(
      python,
      [BUILD_SCRIPT, pdfPath, slidesDir, pptxPath],
      {
        timeout: MAX_CONVERSION_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
      }
    );

    const result = parseScriptJson(stdout);
    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.pageCount || result.pageCount < 1) {
      throw new Error("PPT build produced no slides");
    }

    console.info(
      `[pdf-to-ppt] Built ${result.pageCount} slides at ${result.targetWidth}px width` +
        (result.editableSlides != null ? ` (${result.editableSlides} with editable text)` : "")
    );

    return await fs.readFile(pptxPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function pdfToPpt(
  fileBuffer: Buffer,
  fileName = "document.pdf"
): Promise<Buffer> {
  try {
    if (isConvertApiPptAvailable()) {
      try {
        return await pdfToPptConvertApi(fileBuffer, fileName);
      } catch (err) {
        console.warn("[pdf-to-ppt] ConvertAPI failed, falling back to local build:", err);
      }
    }

    return await pdfToPptLocal(fileBuffer);
  } catch (err) {
    await logError({
      tool_name: "pdf-to-ppt",
      error_type: "PDF_TO_PPT_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });

    const message = err instanceof Error ? err.message : "Unknown error";
    if (/timed out|ETIMEDOUT|SIGTERM|maxDuration/i.test(message)) {
      throw new Error(
        "PDF is too large to convert in one step. Try splitting it into smaller parts, or use a shorter document."
      );
    }
    if (/heap|memory|ENOMEM|allocation/i.test(message)) {
      throw new Error(
        "PDF is too large for local conversion. Try splitting it into smaller parts."
      );
    }

    throw new Error(`Failed to convert PDF to PowerPoint: ${message}`);
  }
}
