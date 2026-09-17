#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import {
  analyzeDocxLayout,
  extractDocxPlainText,
  isRasterPageExport,
} from "../src/lib/services/docx-layout-profile";
import {
  estimatePdfHintsFast,
  isImageHeavyPdf,
  isTextRichManual,
} from "../src/lib/services/pdf-to-word-hints.service";
import { measureDocxQuality } from "../src/lib/services/pdf-to-word-docx-post.service";

const pdfPath = process.argv[2];
const docxPath = process.argv[3];
if (!pdfPath || !docxPath) {
  console.error("Usage: npx tsx scripts/analyze-pdf-docx-pair.ts <pdf> <docx>");
  process.exit(1);
}

async function main() {
  const pdfBuf = fs.readFileSync(pdfPath);
  const docxBuf = fs.readFileSync(docxPath);

  console.log("=== FILE SIZES ===");
  console.log("PDF:", (pdfBuf.length / 1024 / 1024).toFixed(2), "MB");
  console.log("DOCX:", (docxBuf.length / 1024).toFixed(1), "KB");
  console.log("Size ratio:", ((docxBuf.length / pdfBuf.length) * 100).toFixed(2) + "%");

  const hints = await estimatePdfHintsFast(pdfBuf);
  console.log("\n=== PDF HINTS ===");
  console.log(hints);
  console.log("textRichManual:", isTextRichManual(hints, pdfBuf.length));
  console.log("imageHeavy:", isImageHeavyPdf(hints, pdfBuf.length));
  if (hints.pageCount) {
    console.log("bytes/page:", Math.round(pdfBuf.length / hints.pageCount));
  }

  const profile = await analyzeDocxLayout(docxBuf);
  const plainText = await extractDocxPlainText(docxBuf);
  const metrics = await measureDocxQuality(docxBuf);

  console.log("\n=== DOCX LAYOUT ===");
  console.log(profile);
  console.log("metrics:", metrics);
  console.log("rasterExport:", isRasterPageExport(profile, hints.pageCount ?? 1));

  console.log("\n=== TEXT COMPARISON ===");
  const pdfTextLen = hints.pdfTextChars ?? 0;
  console.log("PDF estimated text chars:", pdfTextLen);
  console.log("DOCX extracted text chars:", plainText.length);
  if (pdfTextLen > 0) {
    console.log(
      "Text retention:",
      ((plainText.length / pdfTextLen) * 100).toFixed(1) + "%"
    );
  }

  console.log("\n=== DOCX TEXT PREVIEW (first 800 chars) ===");
  console.log(plainText.slice(0, 800).replace(/\s+/g, " "));

  console.log("\n=== DOCX TEXT PREVIEW (last 400 chars) ===");
  console.log(plainText.slice(-400).replace(/\s+/g, " "));

  // Sample lines from PDF via pdf-parse
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: pdfBuf });
    const text = await parser.getText();
    const pdfPlain = text.text?.replace(/\s+/g, " ").trim() ?? "";
    await parser.destroy();
    console.log("\n=== PDF FULL TEXT (pdf-parse) ===");
    console.log("chars:", pdfPlain.length);
    console.log("preview:", pdfPlain.slice(0, 800));

    const missingSnippets: string[] = [];
    for (const chunk of pdfPlain.match(/.{20,60}/g)?.slice(0, 30) ?? []) {
      if (!plainText.includes(chunk.trim().slice(0, 25))) {
        missingSnippets.push(chunk.trim());
      }
    }
    if (missingSnippets.length) {
      console.log("\n=== LIKELY MISSING SNIPPETS (sample) ===");
      missingSnippets.slice(0, 8).forEach((s) => console.log("-", s.slice(0, 70)));
    }
  } catch (err) {
    console.log("\nPDF text parse failed:", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
