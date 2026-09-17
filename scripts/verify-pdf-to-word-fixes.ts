#!/usr/bin/env tsx
/**
 * End-to-end verification for PDF→Word fixes:
 * - Design poster → word-com (960×540 layout)
 * - Technical manual → pdf2docx (96%+ text, hex labels)
 */
import fs from "fs";
import path from "path";
import {
  analyzeDocxLayout,
  extractDocxPlainText,
  isRasterPageExport,
  matchesSmallPdfClassLayout,
} from "../src/lib/services/docx-layout-profile";
import {
  estimatePdfHintsFast,
  isTextRichManual,
} from "../src/lib/services/pdf-to-word-hints.service";
import {
  isPdf2docxAvailable,
  pdfToWordPdf2docx,
} from "../src/lib/services/pdf-to-word-pdf2docx.service";
import { resolvePdfToWordEngineOrder } from "../src/lib/services/pdf-to-word-engine-plan";
import { isDocxConversionAcceptable } from "../src/lib/services/pdf-to-word-docx-post.service";
import { pdfToWord, type PdfToWordEngine } from "../src/lib/services/pdf-to-word.service";

type CaseSpec = {
  name: string;
  pdfPath: string;
  expectedEngine: PdfToWordEngine;
  textRichManual: boolean;
  checks: (ctx: {
    profile: Awaited<ReturnType<typeof analyzeDocxLayout>>;
    plainText: string;
    hints: Awaited<ReturnType<typeof estimatePdfHintsFast>>;
    engine: PdfToWordEngine;
    buffer: Buffer;
  }) => void;
};

const downloads = path.join(process.env.USERPROFILE ?? "", "Downloads");

const CASES: CaseSpec[] = [
  {
    name: "infographic-poster",
    pdfPath: path.join(downloads, "Research-Infographic-examples.pdf"),
    expectedEngine: "word-com",
    textRichManual: false,
    checks: ({ profile, engine }) => {
      if (engine !== "word-com") {
        throw new Error(`Expected word-com, got ${engine}`);
      }
      if (isRasterPageExport(profile, 33)) {
        throw new Error("Raster page export detected (old broken pipeline)");
      }
      if (profile.pageWidthPt && Math.abs(profile.pageWidthPt - 960) > 20) {
        throw new Error(`Expected ~960pt width, got ${profile.pageWidthPt}`);
      }
      if (!matchesSmallPdfClassLayout(profile, 33)) {
        throw new Error("Layout profile does not match poster class");
      }
    },
  },
  {
    name: "technical-manual",
    pdfPath: path.join(downloads, "60001128H.pdf"),
    expectedEngine: "pdf2docx",
    textRichManual: true,
    checks: ({ profile, plainText, engine }) => {
      if (engine !== "pdf2docx") {
        throw new Error(`Expected pdf2docx, got ${engine}`);
      }
      if (plainText.length < 100_000) {
        throw new Error(`Text too low: ${plainText.length} chars (need 100k+)`);
      }
      for (const term of ["0x4001", "0x4100", "Register 13-6", "Figure 13-11"]) {
        if (!plainText.toLowerCase().includes(term.toLowerCase())) {
          throw new Error(`Missing expected text: ${term}`);
        }
      }
      if (isRasterPageExport(profile, 64)) {
        throw new Error("Raster export detected for manual");
      }
    },
  },
];

async function runCase(spec: CaseSpec): Promise<void> {
  if (!fs.existsSync(spec.pdfPath)) {
    console.log(`SKIP ${spec.name}: file not found (${spec.pdfPath})`);
    return;
  }

  const buf = fs.readFileSync(spec.pdfPath);
  const hints = await estimatePdfHintsFast(buf);
  const textRich = isTextRichManual(hints, buf.length);

  if (textRich !== spec.textRichManual) {
    throw new Error(
      `${spec.name}: textRichManual=${textRich}, expected ${spec.textRichManual}`
    );
  }

  const order = resolvePdfToWordEngineOrder({
    platform: process.platform,
    convertApiAvailable: false,
    convertApiOnly: false,
    textRichManual: textRich,
    pdf2docxReady: await isPdf2docxAvailable(),
    wordComReady: process.platform === "win32",
  });
  console.log(`\n[${spec.name}] hints=`, hints, "engineOrder=", order.slice(0, 4).join(" → "));

  const { buffer, engine } = await pdfToWord({
    inputPath: spec.pdfPath,
    fileName: path.basename(spec.pdfPath),
  });

  if (!buffer?.length) throw new Error(`${spec.name}: no DOCX output`);

  const ok = await isDocxConversionAcceptable(buffer, {
    pageCount: hints.pageCount,
    pdfTextChars: hints.pdfTextChars,
    byteLength: buf.length,
  });
  if (!ok) throw new Error(`${spec.name}: quality gate rejected output`);

  const profile = await analyzeDocxLayout(buffer);
  const plainText = await extractDocxPlainText(buffer);
  spec.checks({ profile, plainText, hints, engine, buffer });

  const out = path.join(process.cwd(), `verify-${spec.name}.docx`);
  fs.writeFileSync(out, buffer);
  console.log(
    `[${spec.name}] PASS engine=${engine} chars=${profile.chars} media=${profile.media} pg=${profile.pageWidthPt}x${profile.pageHeightPt} → ${out}`
  );
}

async function main() {
  console.log("PDF→Word E2E verification");
  let failed = 0;
  for (const spec of CASES) {
    try {
      await runCase(spec);
    } catch (err) {
      failed += 1;
      console.error(`[${spec.name}] FAIL:`, err instanceof Error ? err.message : err);
    }
  }
  if (failed > 0) {
    process.exit(1);
  }
  console.log("\nAll verification cases passed.");
}

main();
