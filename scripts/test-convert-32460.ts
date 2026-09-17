#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { pdfToWord } from "../src/lib/services/pdf-to-word.service";
import { analyzeDocxLayout, extractDocxPlainText } from "../src/lib/services/docx-layout-profile";

const pdfPath = String.raw`c:\Users\NiTiN Dhiman\Downloads\32460-001.pdf`;
const outPath = path.join(process.cwd(), "test-32460-convert.docx");

async function main() {
  console.log("Converting...", pdfPath);
  const result = await pdfToWord({
    inputPath: pdfPath,
    outputPath: outPath,
    fileName: "32460-001.pdf",
  });
  const stat = fs.statSync(result.outputPath ?? outPath);
  const buf = fs.readFileSync(result.outputPath ?? outPath);
  const profile = await analyzeDocxLayout(buf);
  const text = await extractDocxPlainText(buf);
  console.log("engine:", result.engine);
  console.log("size:", stat.size, "bytes");
  console.log("profile:", profile);
  console.log("text chars:", text.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
