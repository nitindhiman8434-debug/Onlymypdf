import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { compressPDF } from "../src/lib/services/pdf-compress.service";
import { deletePdfPages } from "../src/lib/services/pdf-delete.service";
import { mergePDFs } from "../src/lib/services/pdf-merge.service";
import { rotatePdfPages } from "../src/lib/services/pdf-rotate.service";
import { extractPages, splitPDF } from "../src/lib/services/pdf-split.service";
import { validateConversionOutput } from "../src/lib/services/conversion-output-validation";
import { renderPageThumb } from "../src/lib/pdf/pdf-thumbnails.server";

type Profile =
  | "text"
  | "table"
  | "scan"
  | "hindi"
  | "mixed-orientation"
  | "form"
  | "fonts"
  | "large-shape";
type Operation = "rotate" | "split" | "extract" | "delete" | "merge" | "compress";

type CorpusCase = {
  id: string;
  profile: Profile;
  operation: Operation;
  sourcePages: number;
  expectedPages: number;
  features: string[];
};

const root = path.resolve(process.cwd(), "quality", "phase1-corpus");
const generated = path.join(root, "generated");
const profileCounts: Array<[Profile, number]> = [
  ["text", 60],
  ["table", 35],
  ["scan", 25],
  ["hindi", 20],
  ["mixed-orientation", 20],
  ["form", 15],
  ["fonts", 15],
  ["large-shape", 10],
];
const operations: Operation[] = ["rotate", "split", "extract", "delete", "merge", "compress"];

function scanPng(label: string, hindi = false): Buffer {
  const canvas = createCanvas(1100, 600);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#172554";
  context.font = hindi ? '54px "Nirmala UI", sans-serif' : "54px Arial";
  context.fillText(label, 70, 150);
  context.font = "30px Arial";
  context.fillText("OnlyMyPDF Phase 1 corpus image-only page", 70, 230);
  context.strokeStyle = "#2563eb";
  context.lineWidth = 4;
  context.strokeRect(60, 70, 980, 430);
  return canvas.toBuffer("image/png");
}

async function buildPdf(profile: Profile, index: number, sourcePages: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(profile === "hindi" ? `हिंदी परीक्षण ${index}` : `Phase 1 ${profile} ${index}`);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const courier = await pdf.embedFont(StandardFonts.Courier);
  const scan = profile === "scan" ? await pdf.embedPng(scanPng(`Scan sample ${index}`)) : null;
  const hindi = profile === "hindi" ? await pdf.embedPng(scanPng(`हिंदी दस्तावेज़ ${index}`, true)) : null;

  for (let pageIndex = 0; pageIndex < sourcePages; pageIndex += 1) {
    const landscape = profile === "mixed-orientation" && pageIndex % 2 === 1;
    const page = pdf.addPage(landscape ? [842, 595] : [595, 842]);
    if (scan || hindi) {
      const image = scan ?? hindi!;
      page.drawImage(image, { x: 28, y: 250, width: page.getWidth() - 56, height: 300 });
      continue;
    }

    page.drawText(`OnlyMyPDF Phase 1 — ${profile} — case ${index}`, {
      x: 42,
      y: page.getHeight() - 55,
      size: 16,
      font: profile === "fonts" && pageIndex % 2 ? times : helvetica,
      color: rgb(0.08, 0.2, 0.45),
    });
    page.drawText(`Page ${pageIndex + 1} of ${sourcePages}`, {
      x: 42,
      y: page.getHeight() - 82,
      size: 11,
      font: profile === "fonts" ? courier : helvetica,
    });

    if (profile === "table") {
      const startY = page.getHeight() - 135;
      for (let row = 0; row <= 8; row += 1) {
        page.drawLine({ start: { x: 42, y: startY - row * 34 }, end: { x: 550, y: startY - row * 34 } });
      }
      for (let column = 0; column <= 4; column += 1) {
        page.drawLine({ start: { x: 42 + column * 127, y: startY }, end: { x: 42 + column * 127, y: startY - 272 } });
      }
      for (let row = 0; row < 8; row += 1) {
        page.drawText(`${index}-${row + 1}`, { x: 52, y: startY - row * 34 - 22, size: 10, font: helvetica });
        page.drawText(`${(index + 1) * (row + 1)}.00`, { x: 315, y: startY - row * 34 - 22, size: 10, font: helvetica });
      }
    } else {
      for (let line = 0; line < 16; line += 1) {
        page.drawText(`Deterministic content line ${line + 1}; reference ${index}-${pageIndex + 1}.`, {
          x: 42,
          y: page.getHeight() - 125 - line * 28,
          size: 10,
          font: profile === "fonts" && line % 3 === 0 ? times : helvetica,
        });
      }
    }
  }

  if (profile === "form") {
    const form = pdf.getForm();
    const field = form.createTextField(`reference_${index}`);
    field.setText(`FORM-${String(index).padStart(3, "0")}`);
    field.addToPage(pdf.getPage(0), { x: 42, y: 80, width: 250, height: 28 });
    form.updateFieldAppearances(helvetica);
  }
  return Buffer.from(await pdf.save());
}

function makeCases(): CorpusCase[] {
  const cases: CorpusCase[] = [];
  let sequence = 0;
  for (const [profile, count] of profileCounts) {
    for (let index = 0; index < count; index += 1) {
      const operation = operations[sequence % operations.length];
      const sourcePages = profile === "large-shape" ? 12 + (index % 5) : 2 + (index % 3);
      const expectedPages =
        operation === "split" || operation === "extract"
          ? 1
          : operation === "delete"
            ? sourcePages - 1
            : operation === "merge"
              ? sourcePages * 2
              : sourcePages;
      cases.push({
        id: `P1-${String(sequence + 1).padStart(3, "0")}`,
        profile,
        operation,
        sourcePages,
        expectedPages,
        features: [profile, operation, sourcePages > 10 ? "multi-page-large-shape" : "standard-size"],
      });
      sequence += 1;
    }
  }
  return cases;
}

async function execute(input: Buffer, test: CorpusCase): Promise<Buffer> {
  switch (test.operation) {
    case "rotate":
      return rotatePdfPages(input, { 1: 90 });
    case "split":
      return (await splitPDF(input, [{ start: 1, end: 1 }]))[0];
    case "extract":
      return extractPages(input, [test.sourcePages]);
    case "delete":
      return deletePdfPages(
        input,
        Array.from({ length: test.sourcePages - 1 }, (_, index) => index + 1)
      );
    case "merge":
      return mergePDFs([input, input]);
    case "compress":
      return (await compressPDF(input, "basic")).buffer;
  }
}

async function extractedText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

function pageMapping(test: CorpusCase): { inputPage: number; outputPage: number; rotate: number } {
  if (test.operation === "extract") {
    return { inputPage: test.sourcePages, outputPage: 1, rotate: 0 };
  }
  return { inputPage: 1, outputPage: 1, rotate: test.operation === "rotate" ? 90 : 0 };
}

function dataUrlBuffer(value: string): Buffer {
  const comma = value.indexOf(",");
  return Buffer.from(value.slice(comma + 1), "base64");
}

async function normalizedPixels(image: Buffer, rotate: number): Promise<Buffer> {
  let pipeline = sharp(image, { failOn: "error" });
  if (rotate) pipeline = pipeline.rotate(rotate, { background: "white" });
  return pipeline
    .flatten({ background: "white" })
    .resize(320, 320, { fit: "contain", background: "white" })
    .grayscale()
    .raw()
    .toBuffer();
}

async function visualSimilarity(input: Buffer, output: Buffer, test: CorpusCase): Promise<number> {
  const mapping = pageMapping(test);
  const [inputImage, outputImage] = await Promise.all([
    renderPageThumb(input, mapping.inputPage, 480),
    renderPageThumb(output, mapping.outputPage, 480),
  ]);
  const [source, result] = await Promise.all([
    normalizedPixels(dataUrlBuffer(inputImage), mapping.rotate),
    normalizedPixels(dataUrlBuffer(outputImage), 0),
  ]);
  let difference = 0;
  for (let index = 0; index < source.length; index += 1) {
    difference += Math.abs(source[index] - result[index]);
  }
  return Number((1 - difference / (source.length * 255)).toFixed(4));
}

async function main() {
  await fs.mkdir(generated, { recursive: true });
  const cases = makeCases();
  await fs.writeFile(path.join(root, "manifest.json"), `${JSON.stringify({ version: 1, total: cases.length, cases }, null, 2)}\n`);

  const startedAt = Date.now();
  const results: Array<
    CorpusCase & {
      success: boolean;
      durationMs: number;
      outputBytes?: number;
      textVerified?: boolean;
      visualSimilarity?: number;
      errors: string[];
    }
  > = [];
  for (let index = 0; index < cases.length; index += 1) {
    const test = cases[index];
    const began = Date.now();
    const errors: string[] = [];
    try {
      const input = await buildPdf(test.profile, index, test.sourcePages);
      await fs.writeFile(path.join(generated, `${test.id}.pdf`), input);
      const output = await execute(input, test);
      const validation = await validateConversionOutput(output, "pdf");
      if (!validation.valid) errors.push(...validation.errors);
      if (validation.pageCount !== test.expectedPages) {
        errors.push(`Expected ${test.expectedPages} pages; received ${validation.pageCount ?? "unknown"}.`);
      }
      let textVerified: boolean | undefined;
      if (["text", "table", "mixed-orientation", "form", "fonts", "large-shape"].includes(test.profile)) {
        const text = await extractedText(output);
        textVerified = text.includes("OnlyMyPDF") && text.includes(`case ${index}`);
        if (!textVerified) errors.push("Expected extractable text marker is missing.");
      }
      let similarity: number | undefined;
      if (index % 5 === 0) {
        similarity = await visualSimilarity(input, output, test);
        if (similarity < 0.9) errors.push(`Visual similarity ${similarity} is below 0.90.`);
      }
      results.push({
        ...test,
        success: errors.length === 0,
        durationMs: Date.now() - began,
        outputBytes: output.length,
        ...(textVerified === undefined ? {} : { textVerified }),
        ...(similarity === undefined ? {} : { visualSimilarity: similarity }),
        errors,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      results.push({ ...test, success: false, durationMs: Date.now() - began, errors });
    }
    if ((index + 1) % 25 === 0) console.log(`[phase1-corpus] ${index + 1}/${cases.length}`);
  }

  const successful = results.filter((entry) => entry.success).length;
  const durations = results.map((entry) => entry.durationMs).sort((a, b) => a - b);
  const p95 = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] ?? null;
  const report = {
    generatedAt: new Date().toISOString(),
    jobs: results.length,
    successful,
    failed: results.length - successful,
    successRate: Number(((successful / results.length) * 100).toFixed(2)),
    durationMs: Date.now() - startedAt,
    perJobP95Ms: p95,
    declaredThreshold: 99.5,
    thresholdPassed: successful / results.length >= 0.995,
    fidelityEvidence: {
      textChecks: results.filter((entry) => entry.textVerified !== undefined).length,
      textPassed: results.filter((entry) => entry.textVerified === true).length,
      visualChecks: results.filter((entry) => entry.visualSimilarity !== undefined).length,
      visualPassed: results.filter((entry) => (entry.visualSimilarity ?? 0) >= 0.9).length,
      minimumVisualSimilarity: Math.min(
        ...results
          .map((entry) => entry.visualSimilarity)
          .filter((value): value is number => value !== undefined)
      ),
    },
    results,
  };
  await fs.writeFile(path.join(root, "latest-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
  if (!report.thresholdPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
