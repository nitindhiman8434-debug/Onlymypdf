import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { pdfToPpt } from "../src/lib/services/pdf-to-ppt.service";
import { resolvePdf2docxPython } from "../src/lib/services/pdf-to-word-pdf2docx.service";
import { validateConversionOutput } from "../src/lib/services/conversion-output-validation";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const outDir = path.resolve(root, "tmp/pdfs/phase2.3d");
const renderedDir = path.join(outDir, "rendered");
const generator = path.resolve(root, "scripts/phase2-ppt-corpus.py");
const reportPath = path.resolve(root, "quality/phase2-pdf-to-ppt/latest-corpus-report.json");

type CorpusCase = { id: string; tokens: string[][]; editable: boolean[] };
type VerifiedCase = {
  id: string;
  passed: boolean;
  pageCount: number;
  editableTextBoxes: number[];
  visualMeanAbs: number[];
  errors: string[];
};

async function main() {
  await fs.mkdir(renderedDir, { recursive: true });
  const python = (await resolvePdf2docxPython()) ?? "python";
  const generated = await execFileAsync(python, [generator, "generate", outDir]);
  const cases = (JSON.parse(generated.stdout.trim()) as { cases: CorpusCase[] }).cases;
  const metadataPath = path.join(outDir, "cases.json");
  await fs.writeFile(metadataPath, JSON.stringify({ cases }, null, 2));

  for (const entry of cases) {
    const input = await fs.readFile(path.join(outDir, entry.id + ".pdf"));
    const output = await pdfToPpt(input, entry.id + ".pdf");
    const validation = await validateConversionOutput(output, "pptx");
    if (!validation.valid || validation.pageCount !== entry.tokens.length) {
      throw new Error(entry.id + ": invalid PPTX: " + JSON.stringify(validation));
    }
    await fs.writeFile(path.join(outDir, entry.id + ".pptx"), output);
  }

  const soffice =
    process.env.LIBREOFFICE_PATH ??
    (process.platform === "win32"
      ? "C:\\Program Files\\LibreOffice\\program\\soffice.exe"
      : "/usr/bin/soffice");
  const profile = pathToFileURL(path.join(outDir, "lo-profile")).href;
  await execFileAsync(
    soffice,
    [
      "-env:UserInstallation=" + profile,
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      renderedDir,
      ...cases.map((entry) => path.join(outDir, entry.id + ".pptx")),
    ],
    { timeout: 180_000, maxBuffer: 1024 * 1024 }
  );
  for (const entry of cases) {
    await fs.access(path.join(renderedDir, entry.id + ".pdf"));
  }

  const verified = await execFileAsync(
    python,
    [generator, "verify", outDir, metadataPath],
    { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 }
  );
  const jsonLine = verified.stdout.trim().split(/\r?\n/).reverse().find((line) => line.startsWith("{"));
  if (!jsonLine) throw new Error("Corpus verifier returned no JSON result");
  const results = (JSON.parse(jsonLine) as { results: VerifiedCase[] }).results;
  const report = {
    generatedAt: new Date().toISOString(),
    passed: results.filter((entry) => entry.passed).length,
    total: results.length,
    results,
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.passed !== report.total) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
