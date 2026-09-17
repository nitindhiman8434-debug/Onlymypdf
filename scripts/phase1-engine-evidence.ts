import fs from "node:fs/promises";
import path from "node:path";
import { pdfToExcel } from "../src/lib/services/pdf-to-excel.service";
import { pdfToPpt } from "../src/lib/services/pdf-to-ppt.service";
import { pdfToWord } from "../src/lib/services/pdf-to-word.service";
import { validateConversionOutput } from "../src/lib/services/conversion-output-validation";
import { wordToPdf } from "../src/lib/services/word-to-pdf.service";
import { excelToPdf } from "../src/lib/services/excel-to-pdf.service";
import { pptToPdf } from "../src/lib/services/ppt-to-pdf.service";

const corpus = path.resolve(process.cwd(), "quality", "phase1-corpus", "generated");
const reportPath = path.resolve(process.cwd(), "quality", "phase1-corpus", "engine-report.json");

const jobs = [
  { id: "word-text", source: "P1-001.pdf", kind: "docx" as const },
  { id: "excel-table", source: "P1-061.pdf", kind: "xlsx" as const },
  { id: "ppt-scan", source: "P1-096.pdf", kind: "pptx" as const },
  { id: "ppt-text", source: "P1-001.pdf", kind: "pptx" as const },
];

async function main() {
  const results: Array<Record<string, unknown> & { success: boolean }> = [];
  const officeOutputs = new Map<string, Buffer>();
  for (const job of jobs) {
    const input = await fs.readFile(path.join(corpus, job.source));
    const began = Date.now();
    try {
      let output: Buffer;
      let engine: string;
      if (job.kind === "docx") {
        const attempted: string[] = [];
        const converted = await pdfToWord({
          buffer: input,
          fileName: job.source,
          onEngineAttempt: (value) => attempted.push(value),
        });
        if (!converted.buffer) throw new Error("PDF to Word returned no buffer.");
        output = converted.buffer;
        engine = `${converted.engine}; attempts=${attempted.join(",")}`;
      } else if (job.kind === "xlsx") {
        output = await pdfToExcel(input);
        engine = "table-extract+exceljs";
      } else {
        output = await pdfToPpt(input, job.source);
        engine = process.env.CONVERTAPI_SECRET ? "convertapi-or-local" : "python-local";
      }
      const validation = await validateConversionOutput(output, job.kind);
      officeOutputs.set(job.id, output);
      await fs.writeFile(path.join(corpus, `engine-${job.id}.${job.kind}`), output);
      results.push({
        ...job,
        success: validation.valid,
        engine,
        durationMs: Date.now() - began,
        inputBytes: input.length,
        outputBytes: output.length,
        validation,
      });
    } catch (error) {
      results.push({
        ...job,
        success: false,
        durationMs: Date.now() - began,
        inputBytes: input.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const reverseJobs = [
    { id: "word-to-pdf", sourceId: "word-text", kind: "docx", fileName: "engine-word-text.docx" },
    { id: "excel-to-pdf", sourceId: "excel-table", kind: "xlsx", fileName: "engine-excel-table.xlsx" },
    { id: "ppt-to-pdf", sourceId: "ppt-text", kind: "pptx", fileName: "engine-ppt-text.pptx" },
  ] as const;
  for (const job of reverseJobs) {
    const input = officeOutputs.get(job.sourceId);
    const began = Date.now();
    if (!input) {
      results.push({ ...job, success: false, error: "Forward conversion output is missing." });
      continue;
    }
    try {
      const output =
        job.kind === "docx"
          ? await wordToPdf(input, job.fileName)
          : job.kind === "xlsx"
            ? await excelToPdf(input, job.fileName)
            : await pptToPdf(input, job.fileName);
      const validation = await validateConversionOutput(output, "pdf");
      results.push({
        ...job,
        success: validation.valid,
        engine: "office-auto",
        durationMs: Date.now() - began,
        inputBytes: input.length,
        outputBytes: output.length,
        validation,
      });
    } catch (error) {
      results.push({
        ...job,
        success: false,
        durationMs: Date.now() - began,
        inputBytes: input.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    jobs: results.length,
    passed: results.filter((entry) => entry.success).length,
    failed: results.filter((entry) => !entry.success).length,
    allPassed: results.every((entry) => entry.success),
    results,
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.allPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
