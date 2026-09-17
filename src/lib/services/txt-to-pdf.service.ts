import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import { logError } from "@/lib/db/queries";
import { sanitizeTextForStandardFont } from "@/lib/pdf/pdf-standard-font-text";

interface TxtToPdfOptions {
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  margin?: "none" | "small" | "medium";
  fontSize?: number;
  fontFamily?: "courier" | "helvetica" | "times";
  lineSpacing?: number;
}

type FontMetrics = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

const PAGE_SIZES = {
  a4: { portrait: PageSizes.A4, landscape: [PageSizes.A4[1], PageSizes.A4[0]] as [number, number] },
  letter: { portrait: PageSizes.Letter, landscape: [PageSizes.Letter[1], PageSizes.Letter[0]] as [number, number] },
};

const MARGINS: Record<string, { top: number; right: number; bottom: number; left: number }> = {
  none: { top: 20, right: 20, bottom: 20, left: 20 },
  small: { top: 40, right: 40, bottom: 40, left: 40 },
  medium: { top: 60, right: 60, bottom: 60, left: 60 },
};

const FONT_MAP: Record<string, string> = {
  courier: StandardFonts.Courier,
  helvetica: StandardFonts.Helvetica,
  times: StandardFonts.TimesRoman,
};

/** Normalize line endings before sanitizing glyphs so blank lines survive. */
export function splitSanitizedTextLines(
  textContent: string,
  font: Parameters<typeof sanitizeTextForStandardFont>[1]
): string[] {
  const normalized = textContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) => sanitizeTextForStandardFont(line, font));
}

/**
 * Convert plain text content to a well-formatted PDF.
 * Handles word wrapping, page breaks, and preserves the original text structure.
 */
export async function txtToPdf(
  textContent: string,
  options: TxtToPdfOptions = {}
): Promise<Buffer> {
  const {
    pageSize = "a4",
    orientation = "portrait",
    margin = "small",
    fontSize = 11,
    fontFamily = "helvetica",
    lineSpacing = 1.4,
  } = options;

  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(FONT_MAP[fontFamily] || StandardFonts.Helvetica);
    const pageDimensions = PAGE_SIZES[pageSize]?.[orientation] ?? PageSizes.A4;
    const margins = MARGINS[margin] || MARGINS.small;

    const [pageWidth, pageHeight] = pageDimensions;
    const usableWidth = pageWidth - margins.left - margins.right;
    const lineHeight = fontSize * lineSpacing;

    const lines = splitSanitizedTextLines(textContent, font);

    const wrappedLines: string[] = [];
    for (const line of lines) {
      if (line.trim() === "") {
        wrappedLines.push("");
        continue;
      }

      const wrapped = wrapLine(line, font, fontSize, usableWidth);
      wrappedLines.push(...wrapped);
    }

    let currentPage = pdfDoc.addPage(pageDimensions);
    let yPos = pageHeight - margins.top;
    const startX = margins.left;
    const minY = margins.bottom;

    for (const line of wrappedLines) {
      if (yPos - lineHeight < minY) {
        currentPage = pdfDoc.addPage(pageDimensions);
        yPos = pageHeight - margins.top;
      }

      if (line.trim() !== "") {
        currentPage.drawText(line, {
          x: startX,
          y: yPos - fontSize,
          size: fontSize,
          font,
          color: rgb(0.12, 0.12, 0.12),
          maxWidth: usableWidth,
        });
      }

      yPos -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "TXT to PDF conversion failed";
    await logError({
      tool_name: "txt-to-pdf",
      error_type: "CONVERT_ERROR",
      error_message: message,
      stack_trace: error instanceof Error ? error.stack : undefined,
    }).catch(() => {});
    throw new Error(message);
  }
}

/**
 * Word-wrap a single line to fit within maxWidth using the given font metrics.
 */
function wrapLine(
  line: string,
  font: FontMetrics,
  fontSize: number,
  maxWidth: number
): string[] {
  if (font.widthOfTextAtSize(line, fontSize) <= maxWidth) {
    return [line];
  }

  const words = line.split(/(\s+)/);
  const result: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine + word;
    if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine.trim()) {
        result.push(currentLine.trimEnd());
      }
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        const chars = word.split("");
        let chunk = "";
        for (const char of chars) {
          if (font.widthOfTextAtSize(chunk + char, fontSize) > maxWidth) {
            if (chunk) result.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine.trim()) {
    result.push(currentLine.trimEnd());
  }

  return result.length > 0 ? result : [""];
}

/**
 * Convert a TXT file buffer to PDF.
 */
export async function txtFileToPdf(
  fileBuffer: Buffer,
  _fileName: string,
  options: TxtToPdfOptions = {}
): Promise<Buffer> {
  const textContent = fileBuffer.toString("utf-8");
  return txtToPdf(textContent, options);
}
