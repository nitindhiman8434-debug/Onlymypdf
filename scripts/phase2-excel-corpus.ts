import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ExcelJS from "exceljs";
import { pdfToExcel } from "../src/lib/services/pdf-to-excel.service";
import { validateConversionOutput } from "../src/lib/services/conversion-output-validation";
import { resolvePdf2docxPython } from "../src/lib/services/pdf-to-word-pdf2docx.service";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const outputDir = path.resolve(root, "tmp/pdfs/phase2.3c");
const reportPath = path.resolve(root, "quality/phase2-pdf-to-excel/latest-corpus-report.json");

type CellValue = string | number;
type Case = {
  id: string;
  sourcePath?: string;
  rows?: CellValue[][];
  minimumSheets?: number;
  rejected?: boolean;
  percentCell?: number;
  accountingCell?: number;
};

const cases: Case[] = [
  {
    id: "ruled-invoice",
    rows: [
      ["Item", "Qty", "Unit Price", "Amount"],
      ["Notebook", 2, 12.5, 25],
      ["Pen", 3, 1.2, 3.6],
      ["Discount", 1, -2, -2],
    ],
    accountingCell: 3,
  },
  {
    id: "borderless-table",
    rows: [
      ["Code", "Description", "Count", "Rate"],
      ["00123", "Paper Clips", 15, 0.125],
      ["00007", "Binder Box", 2, 0.07],
      ["1234567890123456", "=SUM(A1:A3)", 0, 0],
    ],
    percentCell: 4,
  },
  {
    id: "multi-page-table",
    minimumSheets: 2,
    rows: [
      [2024, 10, 1250],
      [2025, 12, 1500],
      [2026, 15, 1875],
      [2027, 18, 2250],
    ],
  },
  {
    id: "mixed-orientation",
    minimumSheets: 2,
    rows: [["Quarterly summary cover"], ["North", 42, 9100]],
  },
  { id: "image-only-table", rejected: true },
  { id: "table-with-unmapped-text", rows: [["Notebook", 2, 25]], minimumSheets: 2 },
  {
    id: "phase1-table-regression",
    sourcePath: "quality/phase2-pdf-to-excel/fixtures/phase1-table-regression.pdf",
    minimumSheets: 2,
    rows: [["60-1", 61], ["60-8", 488]],
  },
];

function cellValue(value: ExcelJS.CellValue): CellValue | null {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value && typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  return null;
}

function sameCell(actual: CellValue | null, expected: CellValue): boolean {
  return typeof actual === "number" && typeof expected === "number"
    ? Math.abs(actual - expected) < 0.000001
    : actual === expected;
}

function findRow(workbook: ExcelJS.Workbook, expected: CellValue[]) {
  for (const sheet of workbook.worksheets) {
    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      for (let start = 1; start <= Math.max(1, row.cellCount - expected.length + 1); start++) {
        const matches = expected.every((value, index) =>
          sameCell(cellValue(row.getCell(start + index).value), value)
        );
        if (matches) return { sheet: sheet.name, row: rowNumber, start, cells: row };
      }
    }
  }
  return null;
}

async function main() {
  const python = await resolvePdf2docxPython();
  if (!python) throw new Error("Python with PyMuPDF is required for the Excel corpus.");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await execFileAsync(python, [path.join(root, "scripts/phase2-excel-corpus.py"), outputDir], {
    timeout: 30_000,
  });

  const results = [];
  for (const item of cases) {
    const pdf = await fs.readFile(path.join(root, item.sourcePath ?? `tmp/pdfs/phase2.3c/${item.id}.pdf`));
    const started = Date.now();
    try {
      const output = await pdfToExcel(pdf);
      if (item.rejected) throw new Error("Image-only PDF returned a successful workbook.");
      const validation = await validateConversionOutput(output, "xlsx");
      if (!validation.valid) throw new Error(validation.errors.join("; "));
      await fs.writeFile(path.join(outputDir, `${item.id}.xlsx`), output);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(output);
      if (workbook.worksheets.length < (item.minimumSheets ?? 1)) {
        throw new Error(`Expected at least ${item.minimumSheets} worksheets; got ${workbook.worksheets.length}.`);
      }
      const missing = (item.rows ?? []).filter((row) => !findRow(workbook, row));
      if (missing.length) throw new Error(`Missing semantic rows: ${JSON.stringify(missing)}`);
      if (item.id === "table-with-unmapped-text") {
        const sourceSheet = workbook.getWorksheet("Source text");
        const sourceText = sourceSheet?.getColumn(2).values.map(String).join(" ") ?? "";
        if (!sourceText.includes("Important warranty exceptions and shipping conditions")) {
          throw new Error("Unmapped selectable text was not preserved in Source text.");
        }
      }
      if (item.percentCell) {
        const match = findRow(workbook, item.rows?.[1] ?? []);
        const format = match?.cells.getCell(match.start + item.percentCell - 1).numFmt ?? "";
        if (!format.includes("%")) throw new Error(`Percent display format lost: ${format}`);
      }
      if (item.accountingCell) {
        const match = findRow(workbook, item.rows?.at(-1) ?? []);
        const format = match?.cells.getCell(match.start + item.accountingCell - 1).numFmt ?? "";
        if (!format.includes(";(")) throw new Error(`Accounting display format lost: ${format}`);
      }
      results.push({ id: item.id, passed: true, worksheetCount: workbook.worksheets.length,
        checkedRows: item.rows?.length ?? 0, outputBytes: output.length, durationMs: Date.now() - started });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const passed = item.rejected && /no selectable text|run OCR/i.test(message);
      results.push({ id: item.id, passed, expectedRejection: Boolean(item.rejected),
        error: message, durationMs: Date.now() - started });
    }
  }
  const report = { generatedAt: new Date().toISOString(), passed: results.filter((r) => r.passed).length,
    total: results.length, results };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.passed !== report.total) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
