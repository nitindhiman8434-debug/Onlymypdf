import ExcelJS from "exceljs";
import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { logError } from "@/lib/db/queries";
import {
  extractDocumentTablesForExcel,
  isWeakDocumentExtraction,
  type DocumentExportTable,
} from "@/lib/services/pdf-document-excel.service";
import { resolvePdf2docxPython } from "@/lib/services/pdf-to-word-pdf2docx.service";

const execFileAsync = promisify(execFile);
const EXTRACT_SCRIPT = path.join(process.cwd(), "scripts", "pdf-extract-tables.py");

let cachedExtractPython: string | null | undefined;

async function resolvePdfExtractPython(): Promise<string | null> {
  if (cachedExtractPython !== undefined) return cachedExtractPython;

  const python = await resolvePdf2docxPython();
  if (!python) {
    cachedExtractPython = null;
    return null;
  }

  try {
    const { stdout } = await execFileAsync(
      python,
      ["-c", "import fitz; print('ok')"],
      { timeout: 15_000 }
    );
    if (stdout.includes("ok")) {
      cachedExtractPython = python;
      return cachedExtractPython;
    }
  } catch {
    // try next resolution path below
  }

  cachedExtractPython = null;
  return null;
}

interface TableData {
  rows: string[][];
  row_count: number;
  col_count: number;
}

interface PageData {
  page: number;
  tables: TableData[];
  width: number;
  height: number;
}

interface ExportTableData extends TableData {
  page?: number | null;
}

interface ExtractResult {
  pageCount: number;
  unsupportedPages?: number[];
  pages?: PageData[];
  exportTables?: ExportTableData[];
  masterTable?: TableData;
  mergedTables?: TableData[];
  pagesText?: string[];
}

function computeExtractTimeoutMs(pageCount: number, fileBytes: number): number {
  const sizeMb = fileBytes / (1024 * 1024);
  const base = 120_000;
  const perPage = 3_000;
  const perMb = 5_000;
  return Math.min(3_600_000, Math.floor(base + pageCount * perPage + sizeMb * perMb));
}

async function getPdfPageCount(python: string, pdfPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      python,
      ["-c", "import fitz, sys; doc = fitz.open(sys.argv[1]); print(doc.page_count); doc.close()", pdfPath],
      { timeout: 60_000, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }
    );
    const count = parseInt(stdout.trim(), 10);
    return Number.isFinite(count) && count > 0 ? count : 1;
  } catch {
    return 1;
  }
}

/* ─── helpers ─── */

function parseSemanticNumber(value: string): { value: number; numFmt: string } | null {
  const source = value.trim();
  const negative = source.startsWith("(") && source.endsWith(")");
  const unwrapped = negative ? source.slice(1, -1).trim() : source;
  const currency = unwrapped.match(/^([$€£₹])\s*/)?.[1];
  const withoutCurrency = currency ? unwrapped.replace(/^[$€£₹]\s*/, "") : unwrapped;
  const percent = withoutCurrency.endsWith("%");
  if (currency && percent) return null;
  const numeric = percent ? withoutCurrency.slice(0, -1).trim() : withoutCurrency;
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(numeric)) return null;
  const unsigned = numeric.replace(/^-/, "").replace(/,/g, "");
  const integerPart = unsigned.split(".")[0];
  if (integerPart.length > 1 && integerPart.startsWith("0")) return null;
  const significantDigits = unsigned.replace(/^0+/, "").replace(".", "").length;
  if (significantDigits > 15) return null;
  const parsed = Number(numeric.replace(/,/g, ""));
  const numericValue = (negative ? -parsed : parsed) / (percent ? 100 : 1);
  if (!Number.isFinite(numericValue)) return null;
  const decimals = (unsigned.split(".")[1] ?? "").length;
  const decimalFormat = decimals ? `.${"0".repeat(Math.min(decimals, 8))}` : "";
  const baseFormat = `#,##0${decimalFormat}`;
  if (percent) return { value: numericValue, numFmt: `${baseFormat}%` };
  if (currency) {
    const currencyFormat = `"${currency}"${baseFormat}`;
    return {
      value: numericValue,
      numFmt: negative ? `${currencyFormat};("${currency}"${baseFormat})` : currencyFormat,
    };
  }
  return { value: numericValue, numFmt: negative ? `${baseFormat};(${baseFormat})` : baseFormat };
}

function autoFitColumns(sheet: ExcelJS.Worksheet, maxWidth = 48) {
  sheet.columns.forEach((column) => {
    let longest = 8;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const value = cell.value?.toString() ?? "";
      const lines = value.split("\n");
      const lineLongest = lines.reduce((max, line) => Math.max(max, line.length), 0);
      longest = Math.max(longest, Math.min(lineLongest + 3, maxWidth));
    });
    column.width = longest;
  });
}

function documentCellValue(
  text: string,
  rowIdx: number,
  colIdx: number,
  colCount: number
): ExcelJS.CellValue {
  if (!text.includes("\n")) return text;

  const isSummaryRow = rowIdx === 1 && colCount >= 3 && colIdx <= 3;
  if (isSummaryRow) {
    const lines = text.split("\n");
    const [head, ...rest] = lines;
    if (!head) return text;
    return {
      richText: [
        {
          font: { bold: true, name: "Times New Roman", size: 10 },
          text: rest.length > 0 ? `${head}\n` : head,
        },
        {
          font: { name: "Times New Roman", size: 10 },
          text: rest.join("\n"),
        },
      ],
    };
  }

  return text;
}

/* ─── main extraction via Python ─── */

function stripProgressLines(text: string): string {
  return text
    .replace(/PROGRESS pct=\d+/g, "")
    .replace(/Consider using the pymupdf_layout[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonLineFromOutput(output: string): string {
  const lines = output.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("{")) {
      return trimmed;
    }
  }
  return "";
}

function resolveExtractScriptError(stdout: string, stderr: string, fallback?: string): string {
  const jsonLine = parseJsonLineFromOutput(`${stdout}\n${stderr}`);
  if (jsonLine) {
    try {
      const parsed = JSON.parse(jsonLine) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      // fall through
    }
  }

  const cleanedStderr = stripProgressLines(stderr);
  if (cleanedStderr) return cleanedStderr;

  const cleanedStdout = stripProgressLines(stdout);
  if (cleanedStdout) return cleanedStdout;

  return fallback ?? "Table extraction script failed";
}

async function extractTablesFromPdf(fileBuffer: Buffer): Promise<ExtractResult> {
  const python = await resolvePdfExtractPython();
  if (!python) {
    throw new Error(
      "Python with PyMuPDF (fitz) is required for PDF to Excel. Install: pip install pymupdf"
    );
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-doctor-excel-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outputDir = path.join(tmpDir, "output");

  try {
    await fs.writeFile(pdfPath, fileBuffer);
    await fs.mkdir(outputDir, { recursive: true });

    const pageCount = await getPdfPageCount(python, pdfPath);
    const timeoutMs = computeExtractTimeoutMs(pageCount, fileBuffer.length);

    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(
        python,
        [EXTRACT_SCRIPT, pdfPath, outputDir],
        {
          timeout: timeoutMs,
          maxBuffer: 100 * 1024 * 1024,
          env: { ...process.env, PYTHONIOENCODING: "utf-8", PYMUPDF_MESSAGE: "fd:2" },
        }
      );
      stdout = result.stdout;
      stderr = result.stderr ?? "";
    } catch (err) {
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      stdout = execErr.stdout ?? "";
      stderr = execErr.stderr ?? "";
      throw new Error(
        resolveExtractScriptError(stdout, stderr, execErr.message)
      );
    }

    const jsonLine = parseJsonLineFromOutput(stdout);
    if (!jsonLine) throw new Error("No JSON output from table extraction script");

    const meta = JSON.parse(jsonLine);
    if (meta.error) throw new Error(meta.error);

    const jsonData = fsSync.readFileSync(meta.outputPath, "utf-8");
    return JSON.parse(jsonData) as ExtractResult;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ─── text fallback for PDFs with no tables ─── */

function textToRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
      return [line];
    });
}

function pickTablesForExport(extracted: ExtractResult): TableData[] {
  if (extracted.exportTables?.length) {
    return extracted.exportTables.filter((t) => t.row_count > 0 && t.col_count > 0);
  }
  return (extracted.mergedTables ?? []).filter((t) => t.row_count > 0 && t.col_count > 0);
}

function looksLikeDocumentLayout(table: TableData): boolean {
  for (const row of table.rows.slice(0, 12)) {
    const first = String(row[0] ?? "").trim();
    if (/^\d+\.\s/.test(first)) {
      return !looksLikeFinancialProjection(table);
    }
  }
  return false;
}

function isDocumentExport(tables: TableData[]): boolean {
  if (tables.length === 0) return false;
  if (tables.some(looksLikeFinancialProjection)) return false;
  const hits = tables.filter(looksLikeDocumentLayout).length;
  return hits >= Math.min(2, tables.length);
}

function looksLikeFinancialProjection(table: TableData): boolean {
  const text = table.rows
    .slice(0, 20)
    .flatMap((row) => row.map((c) => String(c ?? "")))
    .join(" ")
    .toUpperCase();
  return (
    text.includes("PARTICULARS") ||
    (text.includes("REVENUE") && text.includes("YEAR")) ||
    text.includes("STORE SALE") ||
    text.includes("CASH FLOW")
  );
}

function validateFinancialExtraction(extracted: ExtractResult): void {
  const tables = pickTablesForExport(extracted);
  if (tables.length === 0) return;

  const primary = tables[0];
  const isFinancial = tables.some(looksLikeFinancialProjection);
  if (!isFinancial) return;

  const { row_count: rows, col_count: cols } = primary;
  if (rows > 80 && cols < 25) {
    throw new Error(
      "Table data was extracted vertically (fragmented rows). " +
        "Please restart the dev server and try again."
    );
  }
}

const SMALLPDF_HEADER_FILL = "FFF2F4F5";
const SMALLPDF_SECTION_FILL = "FFFAFAFA";
const FINANCIAL_DATA_FONT_SIZE = 9;
const FINANCIAL_HEADER_FONT_SIZE = 10;
const FINANCIAL_MONTH_COL_WIDTH = 6.5;

function findYearHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number): number | null {
  for (let rowNumber = 1; rowNumber <= Math.min(6, sheet.rowCount); rowNumber++) {
    const row = sheet.getRow(rowNumber);
    for (let c = 1; c <= columnCount; c++) {
      const value = String(row.getCell(c).value ?? "").toUpperCase();
      if (/\d+(ST|ND|RD|TH)\s+YEAR/.test(value)) {
        return rowNumber;
      }
    }
  }
  return null;
}

function buildYearMergeRanges(columnCount: number, yearStartCol: number) {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let year = 0; year < 5; year += 1) {
    const start = yearStartCol + year * 12;
    const end = start + 11;
    if (start <= columnCount) {
      ranges.push({ start, end: Math.min(end, columnCount) });
    }
  }
  return ranges;
}

function detectYearStartColumn(sheet: ExcelJS.Worksheet, yearRowNumber: number, columnCount: number) {
  const row = sheet.getRow(yearRowNumber);
  for (let c = 1; c <= columnCount; c++) {
    const value = String(row.getCell(c).value ?? "").toUpperCase();
    if (/\d+(ST|ND|RD|TH)\s+YEAR/.test(value)) {
      return c;
    }
  }
  return columnCount >= 62 ? 3 : 2;
}

function applySmallpdfFinancialStyle(sheet: ExcelJS.Worksheet, columnCount: number) {
  const yearRowNumber = findYearHeaderRow(sheet, columnCount);

  if (yearRowNumber) {
    const yearStartCol = detectYearStartColumn(sheet, yearRowNumber, columnCount);
    const yearMergeRanges = buildYearMergeRanges(columnCount, yearStartCol);
    for (const { start, end } of yearMergeRanges) {
      if (end <= columnCount) {
        sheet.mergeCells(yearRowNumber, start, yearRowNumber, end);
      }
    }
  }

  sheet.getColumn(1).width = 2;
  sheet.getColumn(2).width = 28;
  for (let c = 3; c <= Math.min(columnCount, 62); c++) {
    sheet.getColumn(c).width = FINANCIAL_MONTH_COL_WIDTH;
  }

  const monthRowNumber =
    yearRowNumber !== null && yearRowNumber + 1 <= sheet.rowCount
      ? yearRowNumber + 1
      : null;

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const label = String(row.getCell(2).value ?? row.getCell(1).value ?? "").toUpperCase();
    const sectionLetter = String(row.getCell(1).value ?? "").trim();
    const isParticularsRow = label === "PARTICULARS";
    const isTitleRow =
      label.includes("REVENUE MODEL") || label.includes("CASH FLOW");
    const isSectionRow = sectionLetter === "A" && label.length > 0 && label !== "A";
    const isYearRow = rowNumber === yearRowNumber;
    const isMonthRow = rowNumber === monthRowNumber;
    const isHeaderRow = isTitleRow || isParticularsRow || isYearRow || isMonthRow;

    row.height = isHeaderRow ? 18 : 16;

    for (let c = 1; c <= columnCount; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };

      if (isHeaderRow) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: SMALLPDF_HEADER_FILL },
        };
        if (c >= 3) {
          cell.font = {
            bold: true,
            size: FINANCIAL_HEADER_FONT_SIZE,
            name: "Calibri",
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.font = {
            bold: true,
            size: isTitleRow ? 11 : FINANCIAL_HEADER_FONT_SIZE,
            name: "Calibri",
          };
        }
      } else if (isSectionRow) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: SMALLPDF_SECTION_FILL },
        };
        if (c >= 3) {
          cell.font = { size: FINANCIAL_DATA_FONT_SIZE, name: "Calibri" };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      } else if (c >= 3) {
        if (typeof cell.value === "number" && cell.numFmt === "General") {
          cell.numFmt = "#,##0";
        }
        cell.font = { size: FINANCIAL_DATA_FONT_SIZE, name: "Calibri" };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (c === 2) {
        cell.font = { size: FINANCIAL_HEADER_FONT_SIZE, name: "Calibri" };
      }
    }
  });
}

function applyDocumentTableStyle(sheet: ExcelJS.Worksheet, columnCount: number) {
  const displayCols = Math.max(columnCount, 4);

  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 34;
  sheet.getColumn(3).width = 34;
  if (displayCols >= 4) {
    sheet.getColumn(4).width = 14;
  }

  try {
    sheet.mergeCells(1, 1, 1, displayCols);
  } catch {
    /* already merged */
  }

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const firstCellRaw = row.getCell(1).value;
    const firstCell =
      typeof firstCellRaw === "object" && firstCellRaw && "richText" in firstCellRaw
        ? (firstCellRaw as ExcelJS.CellRichTextValue).richText
            .map((part) => part.text)
            .join("")
        : String(firstCellRaw ?? "").trim();
    const isSectionHeader = /^\d+\.\s/.test(firstCell);
    const isSummaryRow = rowNumber === 2;
    const lineCount = Math.max(1, firstCell.split("\n").length);

    if (rowNumber === 1) {
      row.height = 40;
    } else if (isSectionHeader) {
      row.height = 28;
    } else if (isSummaryRow) {
      row.height = 58;
    } else {
      row.height = Math.min(140, Math.max(24, lineCount * 15 + 6));
    }

    for (let c = 1; c <= columnCount; c++) {
      const cell = row.getCell(c);
      const bold = isSectionHeader || (isSummaryRow && c <= 3);
      cell.font = {
        name: "Times New Roman",
        size: isSectionHeader ? 14 : 10,
        bold: isSectionHeader ? true : bold,
      };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFBFBF" } },
        bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
        left: { style: "thin", color: { argb: "FFBFBFBF" } },
        right: { style: "thin", color: { argb: "FFBFBFBF" } },
      };

      if (isSummaryRow && c <= 3) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F9FA" },
        };
      }

      if (rowNumber === 1) {
        cell.font = {
          name: "Times New Roman",
          size: 11,
          bold: true,
        };
        cell.alignment = { vertical: "top", wrapText: true };
      }
    }
  });
}

function writeTableToSheet(
  workbook: ExcelJS.Workbook,
  table: TableData,
  sheetName: string,
  useSmallpdfStyle = false,
  useDocumentStyle = false
) {
  if (table.row_count === 0) return;

  const sheet = workbook.addWorksheet(sheetName);

  for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
    const rowData = table.rows[rowIdx];
    const excelRow = sheet.getRow(rowIdx + 1);

    for (let colIdx = 0; colIdx < table.col_count; colIdx++) {
      const cell = excelRow.getCell(colIdx + 1);
      const raw = rowData[colIdx];

      if (raw === null || raw === undefined || raw === "") {
        cell.value = null;
        continue;
      }

      if (typeof raw === "number") {
        cell.value = raw;
        continue;
      }

      const text = String(raw).trim();
      if (text === "" || text === "-") {
        cell.value = text || null;
        continue;
      }

      if (/\d[\d,]*\s+\d/.test(text)) {
        cell.value = text;
        continue;
      }

      const num = parseSemanticNumber(text);
      if (num) {
        cell.value = num.value;
        cell.numFmt = num.numFmt;
      } else {
        cell.value = useDocumentStyle
          ? documentCellValue(text, rowIdx, colIdx, table.col_count)
          : text;
      }
    }
  }

  if (useSmallpdfStyle) {
    applySmallpdfFinancialStyle(sheet, table.col_count);
  } else if (useDocumentStyle) {
    applyDocumentTableStyle(sheet, table.col_count);
  }
}

/* ─── main export ─── */

async function resolveExportTables(
  fileBuffer: Buffer,
  extracted: ExtractResult
): Promise<{ tables: TableData[]; useDocumentStyle: boolean }> {
  const pythonTables = pickTablesForExport(extracted);
  const isFinancial = pythonTables.some(looksLikeFinancialProjection);

  if (isFinancial) {
    return { tables: pythonTables, useDocumentStyle: false };
  }

  let bestTables: TableData[] = pythonTables;

  if (isWeakDocumentExtraction(pythonTables as DocumentExportTable[])) {
    try {
      const tsTables = await extractDocumentTablesForExcel(fileBuffer);
      if (tsTables.length > 0 && !isWeakDocumentExtraction(tsTables)) {
        bestTables = tsTables;
      }
    } catch {
      /* keep python tables */
    }
  }

  return {
    tables: bestTables,
    useDocumentStyle: isDocumentExport(bestTables),
  };
}

export async function pdfToExcel(fileBuffer: Buffer): Promise<Buffer> {
  try {
    const extracted = await extractTablesFromPdf(fileBuffer);
    if (extracted.unsupportedPages?.length) {
      throw new Error(
        `Pages ${extracted.unsupportedPages.join(", ")} have no selectable text. Run OCR before converting to Excel.`
      );
    }
    validateFinancialExtraction(extracted);
    const { tables: pageTables, useDocumentStyle } = await resolveExportTables(
      fileBuffer,
      extracted
    );
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OnlyMyPDF";
    workbook.created = new Date();

    const useSmallpdfStyle = pageTables.some(looksLikeFinancialProjection);

    if (pageTables.length > 0) {
      for (let tIdx = 0; tIdx < pageTables.length; tIdx++) {
        writeTableToSheet(
          workbook,
          pageTables[tIdx],
          `Table ${tIdx + 1}`,
          useSmallpdfStyle,
          useDocumentStyle
        );
      }
    } else if (extracted.masterTable && extracted.masterTable.row_count > 0) {
      writeTableToSheet(workbook, extracted.masterTable, "Table 1");
    } else {
      const sheet = workbook.addWorksheet("Extracted Content");
      const allText = (extracted.pagesText ?? []).join("\n");
      const rows = textToRows(allText);

      if (rows.length > 0) {
        const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 1);
        for (const row of rows) {
          while (row.length < maxCols) row.push("");
          sheet.addRow(row);
        }
        autoFitColumns(sheet);
      } else {
        throw new Error("No extractable text found in this PDF. Run OCR before converting to Excel.");
      }
    }

    if (workbook.worksheets.length === 0) {
      const sheet = workbook.addWorksheet("Extracted Content");
      sheet.addRow(["No extractable content found in this PDF."]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (err) {
    await logError({
      tool_name: "pdf-to-excel",
      error_type: "PDF_TO_EXCEL_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(
      `Failed to convert PDF to Excel: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
