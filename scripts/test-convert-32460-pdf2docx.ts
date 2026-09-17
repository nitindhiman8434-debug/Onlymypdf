#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { pdfToWordPdf2docx, isPdf2docxAvailable } from "../src/lib/services/pdf-to-word-pdf2docx.service";
import { analyzeDocxLayout, extractDocxPlainText } from "../src/lib/services/docx-layout-profile";

const pdfPath = String.raw`c:\Users\NiTiN Dhiman\Downloads\32460-001.pdf`;
const outPath = path.join(process.cwd(), "test-32460-pdf2docx.docx");

async function main() {
  if (!(await isPdf2docxAvailable())) {
    console.log("pdf2docx not available");
    process.exit(1);
  }
  await pdfToWordPdf2docx(Buffer.alloc(0), {
    inputPath: pdfPath,
    outputPath: outPath,
    timeoutMs: 300_000,
  });
  const buf = fs.readFileSync(outPath);
  const profile = await analyzeDocxLayout(buf);
  const text = await extractDocxPlainText(buf);
  console.log("size:", buf.length);
  console.log("profile:", profile);
  console.log("text chars:", text.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
