import { PDFDocument } from "pdf-lib";
import { logError } from "@/lib/db/queries";

async function loadWithPdfLib(fileBuffer: Buffer) {
  return PDFDocument.load(fileBuffer, { ignoreEncryption: true });
}

export async function splitPDF(
  fileBuffer: Buffer,
  ranges: { start: number; end: number }[]
): Promise<Buffer[]> {
  try {
    const sourcePdf = await loadWithPdfLib(fileBuffer);
    const totalPages = sourcePdf.getPageCount();
    const results: Buffer[] = [];

    for (const range of ranges) {
      if (range.start < 1 || range.end > totalPages || range.start > range.end) {
        throw new Error(
          `Invalid page range ${range.start}-${range.end}. Document has ${totalPages} pages.`
        );
      }

      const newPdf = await PDFDocument.create();
      const pageIndices = Array.from(
        { length: range.end - range.start + 1 },
        (_, i) => range.start - 1 + i
      );
      const pages = await newPdf.copyPages(sourcePdf, pageIndices);

      for (const page of pages) {
        newPdf.addPage(page);
      }

      const pdfBytes = await newPdf.save();
      results.push(Buffer.from(pdfBytes));
    }

    return results;
  } catch (err) {
    await logError({
      tool_name: "split-pdf",
      error_type: "SPLIT_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(
      `Failed to split PDF: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}

export async function splitAllPages(fileBuffer: Buffer): Promise<Buffer[]> {
  try {
    const sourcePdf = await loadWithPdfLib(fileBuffer);
    const totalPages = sourcePdf.getPageCount();
    const results: Buffer[] = [];

    for (let i = 0; i < totalPages; i++) {
      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(sourcePdf, [i]);
      newPdf.addPage(page);
      const pdfBytes = await newPdf.save();
      results.push(Buffer.from(pdfBytes));
    }

    return results;
  } catch (err) {
    await logError({
      tool_name: "split-pdf",
      error_type: "SPLIT_ALL_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(
      `Failed to split all pages: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}

export async function extractPages(
  fileBuffer: Buffer,
  pageNumbers: number[]
): Promise<Buffer> {
  try {
    const sourcePdf = await loadWithPdfLib(fileBuffer);
    const totalPages = sourcePdf.getPageCount();

    for (const num of pageNumbers) {
      if (num < 1 || num > totalPages) {
        throw new Error(
          `Page ${num} does not exist. Document has ${totalPages} pages.`
        );
      }
    }

    const newPdf = await PDFDocument.create();
    const zeroIndexed = pageNumbers.map((n) => n - 1);
    const pages = await newPdf.copyPages(sourcePdf, zeroIndexed);

    for (const page of pages) {
      newPdf.addPage(page);
    }

    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes);
  } catch (err) {
    await logError({
      tool_name: "split-pdf",
      error_type: "EXTRACT_PAGES_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(
      `Failed to extract pages: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
