import {
  isLibreOfficeAvailable,
  libreOfficeToPdf,
} from "@/lib/services/libreoffice-core.service";

export { isLibreOfficeAvailable, resolveLibreOfficeBinary } from "@/lib/services/libreoffice-core.service";

/**
 * Convert Word/Excel/PowerPoint/ODF documents to PDF via LibreOffice headless.
 * Used by word-to-pdf, excel-to-pdf, and ppt-to-pdf pipelines.
 */
export async function tryConvertWithLibreOffice(
  fileBuffer: Buffer,
  fileName?: string,
  timeoutMs?: number
): Promise<Buffer | null> {
  if (!isLibreOfficeAvailable()) {
    console.info("[libreoffice] Binary not found — skip Office→PDF");
    return null;
  }

  const effectiveTimeout =
    timeoutMs ?? (process.platform === "win32" ? 90_000 : 180_000);

  const pdf = await libreOfficeToPdf(fileBuffer, fileName, effectiveTimeout);
  if (pdf?.length) {
    console.info(`[libreoffice] Office→PDF OK (${pdf.length} bytes)`);
    return pdf;
  }

  return null;
}
