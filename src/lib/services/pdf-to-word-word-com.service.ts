import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const WORD_IMPORT_SCRIPT = path.join(
  process.cwd(),
  "scripts",
  "word-import-pdf.vbs"
);
const WORD_PROBE_SCRIPT = path.join(process.cwd(), "scripts", "word-probe.vbs");

export async function isWordComPdfImportAvailable(): Promise<boolean> {
  if (process.platform !== "win32") return false;
  try {
    const { stdout } = await execFileAsync(
      "cscript",
      ["//Nologo", WORD_PROBE_SCRIPT],
      { timeout: 12_000, windowsHide: true }
    );
    return stdout.includes("OK");
  } catch {
    return false;
  }
}

function killWordProcesses(): void {
  if (process.platform !== "win32") return;
  execFile("taskkill", ["/F", "/IM", "WINWORD.EXE"], { windowsHide: true }, () => undefined);
}

export type PdfToWordWordComOptions = {
  inputPath?: string;
  outputPath?: string;
  timeoutMs?: number;
};

/**
 * Convert PDF → DOCX via Microsoft Word COM (Windows only).
 * Matches professional-grade layout for invoices, forms, and complex PDFs.
 */
export async function pdfToWordWordCom(
  fileBuffer: Buffer,
  options: PdfToWordWordComOptions = {}
): Promise<Buffer | void> {
  if (process.platform !== "win32") return undefined;

  const diskOnly = Boolean(options.outputPath);
  const timeoutMs = options.timeoutMs ?? 45_000;
  const tmpDir =
    options.inputPath && options.outputPath
      ? path.dirname(options.inputPath)
      : await fs.mkdtemp(path.join(os.tmpdir(), "pdfdoctor-word-import-"));
  const pdfPath = options.inputPath ?? path.join(tmpDir, "input.pdf");
  const docxPath = options.outputPath ?? path.join(tmpDir, "output.docx");
  const ownsTmpDir = !options.inputPath;

  try {
    if (!options.inputPath) {
      await fs.writeFile(pdfPath, fileBuffer);
    }

    const { stdout, stderr } = await execFileAsync(
      "cscript",
      ["//Nologo", WORD_IMPORT_SCRIPT, pdfPath, docxPath],
      { timeout: timeoutMs, windowsHide: true }
    );

    const combined = `${stdout}\n${stderr}`.trim();
    if (!combined.includes("OK")) {
      console.warn("[pdf-to-word-word-com] VBScript failed:", combined);
      return undefined;
    }

    if (diskOnly) return;

    return await fs.readFile(docxPath);
  } catch (err) {
    const timedOut =
      err instanceof Error &&
      ("killed" in err || /timed out|ETIMEDOUT|SIGTERM/i.test(err.message));
    if (timedOut) {
      killWordProcesses();
    }
    console.warn(
      "[pdf-to-word-word-com] Failed:",
      err instanceof Error ? err.message : err
    );
    return undefined;
  } finally {
    if (ownsTmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
