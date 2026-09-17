import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

export type ConversionOutputKind =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "txt"
  | "html"
  | "image";

export type ConversionOutputValidation = {
  valid: boolean;
  kind: ConversionOutputKind;
  byteLength: number;
  signatureValid: boolean;
  openable: boolean;
  pageCount?: number;
  entryCount?: number;
  textCharacters?: number;
  errors: string[];
  warnings: string[];
  checkedAt: string;
};

type OfficeKind = Extract<ConversionOutputKind, "docx" | "xlsx" | "pptx">;

const OFFICE_REQUIRED_PARTS: Record<OfficeKind, string[]> = {
  docx: ["[Content_Types].xml", "word/document.xml"],
  xlsx: ["[Content_Types].xml", "xl/workbook.xml"],
  pptx: ["[Content_Types].xml", "ppt/presentation.xml"],
};

function result(
  kind: ConversionOutputKind,
  buffer: Buffer,
  fields: Partial<ConversionOutputValidation>
): ConversionOutputValidation {
  const errors = fields.errors ?? [];
  return {
    valid: errors.length === 0 && fields.signatureValid === true && fields.openable === true,
    kind,
    byteLength: buffer.length,
    signatureValid: fields.signatureValid ?? false,
    openable: fields.openable ?? false,
    errors,
    warnings: fields.warnings ?? [],
    checkedAt: new Date().toISOString(),
    ...(fields.pageCount === undefined ? {} : { pageCount: fields.pageCount }),
    ...(fields.entryCount === undefined ? {} : { entryCount: fields.entryCount }),
    ...(fields.textCharacters === undefined
      ? {}
      : { textCharacters: fields.textCharacters }),
  };
}

async function validatePdf(buffer: Buffer): Promise<ConversionOutputValidation> {
  const signatureValid = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const errors: string[] = [];
  if (!signatureValid) errors.push("PDF signature is missing.");

  try {
    const document = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    const pageCount = document.getPageCount();
    if (pageCount < 1) errors.push("PDF has no pages.");
    return result("pdf", buffer, {
      signatureValid,
      openable: true,
      pageCount,
      errors,
    });
  } catch {
    errors.push("PDF cannot be opened by the validator.");
    return result("pdf", buffer, { signatureValid, openable: false, errors });
  }
}

function xmlTextCharacters(xml: string): number {
  return xml
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos);/g, "x")
    .replace(/\s+/g, "")
    .length;
}

async function validateOffice(
  kind: OfficeKind,
  buffer: Buffer
): Promise<ConversionOutputValidation> {
  const signatureValid =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
  const errors: string[] = [];
  if (!signatureValid) errors.push("Open XML ZIP signature is missing.");

  try {
    const archive = await JSZip.loadAsync(buffer, { checkCRC32: true });
    const names = Object.keys(archive.files);
    for (const required of OFFICE_REQUIRED_PARTS[kind]) {
      if (!archive.file(required)) errors.push(`Required package part is missing: ${required}`);
    }

    let pageCount: number | undefined;
    let textCharacters = 0;
    if (kind === "docx") {
      const xml = await archive.file("word/document.xml")?.async("string");
      textCharacters = xml ? xmlTextCharacters(xml) : 0;
      pageCount = Math.max(1, (xml?.match(/<w:br[^>]+w:type=["']page["']/g) ?? []).length + 1);
    } else if (kind === "xlsx") {
      const sheets = names.filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
      pageCount = sheets.length;
      for (const name of ["xl/sharedStrings.xml", ...sheets]) {
        const xml = await archive.file(name)?.async("string");
        if (xml) textCharacters += xmlTextCharacters(xml);
      }
      if (sheets.length === 0) errors.push("Workbook contains no worksheets.");
    } else {
      const slides = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
      pageCount = slides.length;
      for (const name of slides) {
        const xml = await archive.file(name)?.async("string");
        if (xml) textCharacters += xmlTextCharacters(xml);
      }
      if (slides.length === 0) errors.push("Presentation contains no slides.");
    }

    return result(kind, buffer, {
      signatureValid,
      openable: true,
      pageCount,
      entryCount: names.length,
      textCharacters,
      errors,
      warnings:
        textCharacters === 0
          ? ["The package is structurally valid but contains no extractable text."]
          : [],
    });
  } catch {
    errors.push("Open XML package cannot be opened or failed its CRC check.");
    return result(kind, buffer, { signatureValid, openable: false, errors });
  }
}

function validateText(
  kind: Extract<ConversionOutputKind, "txt" | "html">,
  buffer: Buffer
): ConversionOutputValidation {
  const value = buffer.toString("utf8");
  const replacementRatio = value.length
    ? (value.match(/\uFFFD/g)?.length ?? 0) / value.length
    : 1;
  const errors: string[] = [];
  if (!value.trim()) errors.push("Output is empty.");
  if (replacementRatio > 0.01) errors.push("Output is not valid UTF-8 text.");
  if (kind === "html" && !/<(?:html|body|main|article|p|div)[\s>]/i.test(value)) {
    errors.push("HTML output has no document or content element.");
  }
  return result(kind, buffer, {
    signatureValid: errors.length === 0,
    openable: errors.length === 0,
    textCharacters: value.replace(/\s+/g, "").length,
    errors,
  });
}

function validateImage(buffer: Buffer): ConversionOutputValidation {
  const isPng = buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  const isJpeg = buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const signatureValid = isPng || isJpeg || isWebp;
  return result("image", buffer, {
    signatureValid,
    openable: signatureValid,
    errors: signatureValid ? [] : ["Supported image signature is missing."],
  });
}

/**
 * Validates the produced container before a job is marked complete. This is a
 * fast structural gate; content fidelity is measured separately by the corpus.
 */
export async function validateConversionOutput(
  buffer: Buffer,
  kind: ConversionOutputKind
): Promise<ConversionOutputValidation> {
  if (buffer.length === 0) {
    return result(kind, buffer, {
      signatureValid: false,
      openable: false,
      errors: ["Output is empty."],
    });
  }
  if (kind === "pdf") return validatePdf(buffer);
  if (kind === "docx" || kind === "xlsx" || kind === "pptx") {
    return validateOffice(kind, buffer);
  }
  if (kind === "txt" || kind === "html") return validateText(kind, buffer);
  return validateImage(buffer);
}
