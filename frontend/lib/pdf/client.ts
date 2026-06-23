// ============================================================
// Client-side PDF helpers (Phase 4 foundation).
// These run entirely in the browser — files are NEVER uploaded.
// Heavy libs (pdf-lib, pdfjs-dist) are dynamically imported so they
// only load on the relevant tool page (keeps the bundle small).
// ============================================================

/** Merge multiple PDFs into one (in-browser). */
export async function mergePdfs(files: File[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const saved = await out.save();
  return new Blob([saved], { type: "application/pdf" });
}

/** Rotate every page by a multiple of 90° (in-browser). */
export async function rotatePdf(file: File, degrees: number): Promise<Blob> {
  const { PDFDocument, degrees: deg } = await import("pdf-lib");
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  doc.getPages().forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(deg((current + degrees) % 360));
  });
  return new Blob([await doc.save()], { type: "application/pdf" });
}

/** Keep only the given 1-based page numbers (extract pages, in-browser). */
export async function extractPages(file: File, pages: number[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  const out = await PDFDocument.create();
  const indices = pages.map((p) => p - 1).filter((i) => i >= 0 && i < src.getPageCount());
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  return new Blob([await out.save()], { type: "application/pdf" });
}

/** Convert images (JPG/PNG) into a single PDF (in-browser). */
export async function imagesToPdf(files: File[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const img = file.type.includes("png")
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return new Blob([await doc.save()], { type: "application/pdf" });
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
