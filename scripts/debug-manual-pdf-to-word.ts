import fs from "fs";
import {
  estimatePdfHintsFast,
  isTextRichManual,
} from "../src/lib/services/pdf-to-word-hints.service";
import {
  isDocxConversionAcceptable,
  measureDocxQuality,
} from "../src/lib/services/pdf-to-word-docx-post.service";
import { isPdf2docxAvailable, pdfToWordPdf2docx } from "../src/lib/services/pdf-to-word-pdf2docx.service";
import { pdfToWord } from "../src/lib/services/pdf-to-word.service";

const pdfPath = process.argv[2] ?? String.raw`c:\Users\NiTiN Dhiman\Downloads\60001128H.pdf`;

async function main() {
  const buf = fs.readFileSync(pdfPath);
  const hints = await estimatePdfHintsFast(buf);
  console.log("hints", hints);
  console.log("textRichManual", isTextRichManual(hints, buf.length));
  console.log("pdf2docxAvailable", await isPdf2docxAvailable());

  const { buffer, engine } = await pdfToWord({
    inputPath: pdfPath,
    fileName: "60001128H.pdf",
  });
  if (!buffer) throw new Error("no output");
  const metrics = await measureDocxQuality(buffer);
  const ok = await isDocxConversionAcceptable(buffer, {
    pageCount: hints.pageCount,
    pdfTextChars: hints.pdfTextChars ?? 127_616,
  });
  console.log("engine", engine, "ok", ok, "metrics", metrics);
  fs.writeFileSync("test-manual-output.docx", buffer);
  console.log("saved test-manual-output.docx", buffer.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
