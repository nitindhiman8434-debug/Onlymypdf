#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const baseUrl = (process.env.LOCAL_PREVIEW_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const input = await fs.readFile(
  path.resolve("quality/phase2-pdf-to-excel/fixtures/phase1-table-regression.pdf")
);
const form = new FormData();
form.append("file", new Blob([new Uint8Array(input)], { type: "application/pdf" }), "phase1-table-regression.pdf");
form.append("options", "{}");

async function jsonOrThrow(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

try {
  const start = await fetch(`${baseUrl}/api/tools/pdf-to-word`, {
    method: "POST",
    headers: { Origin: baseUrl, "X-Pdf-To-Word-Job": "1" },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  const cookie = start.headers.get("set-cookie")?.match(/(?:^|,\s*)(pd_guest_session=[^;]+)/i)?.[1];
  const { jobId } = await jsonOrThrow(start);
  if (!cookie || !jobId) throw new Error("Job ID or guest session cookie missing");

  let done;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/tools/pdf-to-word/status?jobId=${encodeURIComponent(jobId)}`, {
      headers: { Origin: baseUrl, Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const status = await jsonOrThrow(response);
    if (status.status === "error") throw new Error(`Conversion failed: ${status.error || "unknown"}`);
    if (status.status === "done") {
      done = status;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!done) throw new Error("Job did not finish within three minutes");

  const download = await fetch(`${baseUrl}/api/tools/pdf-to-word/download?jobId=${encodeURIComponent(jobId)}`, {
    headers: { Origin: baseUrl, Cookie: cookie },
    signal: AbortSignal.timeout(30_000),
  });
  if (!download.ok) throw new Error(`Download HTTP ${download.status}`);
  const bytes = Buffer.from(await download.arrayBuffer());
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const document = await zip.file("word/document.xml")?.async("string");
  if (!document?.includes("60-1")) throw new Error("Editable fixture text missing from DOCX");

  console.log(JSON.stringify({
    baseUrl,
    inputBytes: input.length,
    outputBytes: bytes.length,
    openable: true,
    editableFixtureTextFound: true,
    engine: done.engine ?? null,
    outputValid: done.outputValid ?? null,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
