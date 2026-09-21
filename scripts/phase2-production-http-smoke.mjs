#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const baseUrl = (process.env.PHASE2_3E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const fixturePath = path.resolve(
  "quality/phase2-pdf-to-excel/fixtures/phase1-table-regression.pdf"
);
const reportPath = path.resolve(
  process.env.PHASE2_3E_REPORT || "quality/phase2-production/latest-http-report.json"
);

async function validateOfficeOutput(output, kind) {
  if (output.length < 4 || output.subarray(0, 2).toString("ascii") !== "PK") {
    throw new Error(`${kind}: ZIP signature is missing`);
  }
  const archive = await JSZip.loadAsync(output, { checkCRC32: true });
  const manifest = kind === "xlsx" ? "xl/workbook.xml" : "ppt/presentation.xml";
  if (!archive.file("[Content_Types].xml") || !archive.file(manifest)) {
    throw new Error(`${kind}: required Office package parts are missing`);
  }
  const partPattern = kind === "xlsx" ? /^xl\/worksheets\/sheet\d+\.xml$/i : /^ppt\/slides\/slide\d+\.xml$/i;
  const parts = Object.keys(archive.files).filter((name) => partPattern.test(name));
  if (parts.length === 0) throw new Error(`${kind}: no sheets or slides`);
  const xmlParts = kind === "xlsx" ? ["xl/sharedStrings.xml", ...parts] : parts;
  const xml = (
    await Promise.all(xmlParts.map(async (name) => (await archive.file(name)?.async("string")) || ""))
  ).join(" ");
  if (!xml.includes("60-1")) throw new Error(`${kind}: expected editable fixture text is missing`);
  return { openable: true, partCount: parts.length, expectedEditableTextFound: true };
}

async function runConversion(source, slug, kind) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(source)], { type: "application/pdf" }), "phase1-table-regression.pdf");
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/tools/${slug}`, {
    method: "POST",
    headers: { Origin: baseUrl },
    body: form,
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${slug}: HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const output = Buffer.from(await response.arrayBuffer());
  const validation = await validateOfficeOutput(output, kind);
  const contentType = response.headers.get("content-type") || "";
  const expectedContentType =
    kind === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (contentType !== expectedContentType) {
    throw new Error(`${slug}: unexpected content type ${contentType}`);
  }

  return {
    tool: slug,
    elapsedMs,
    inputBytes: source.length,
    outputBytes: output.length,
    sha256: crypto.createHash("sha256").update(output).digest("hex"),
    contentType,
    validation,
  };
}

async function main() {
  const url = new URL(baseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (process.env.PHASE2_3E_EXPECT_PUBLIC === "1" && (local || url.protocol !== "https:")) {
    throw new Error("Public gate requires an HTTPS non-local base URL.");
  }

  const source = await fs.readFile(fixturePath);
  const conversions = [];
  conversions.push(await runConversion(source, "pdf-to-excel", "xlsx"));
  conversions.push(await runConversion(source, "pdf-to-ppt", "pptx"));

  const report = {
    generatedAt: new Date().toISOString(),
    target: local ? "local" : "remote",
    baseUrl,
    fixture: path.relative(process.cwd(), fixturePath).replace(/\\/g, "/"),
    note: "One controlled HTTP sample per tool. This is not a latency percentile, load test, or universal accuracy score.",
    conversions,
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
