#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const baseUrl = (process.env.PHASE2_LOCAL_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
if (!["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname)) {
  throw new Error("This capacity runner is intentionally limited to localhost.");
}

const caseName = process.argv[2] || "medium";
if (!["medium", "large", "large-word", "parallel", "free-cap-excel", "free-cap-ppt", "free-cap-word", "above-free-cap"].includes(caseName)) {
  throw new Error("Choose medium, large, large-word, parallel or a free-cap tool case.");
}
const nearFreeCap = caseName.startsWith("free-cap-");
const fixtureName = caseName === "above-free-cap" ? "mixed-23-page.pdf"
  : nearFreeCap ? "mixed-22-page.pdf"
  : caseName === "large" || caseName === "large-word" ? "mixed-8-page.pdf" : "mixed-4-page.pdf";
const fixturePath = path.resolve("quality/phase2-production/generated", fixtureName);
const input = await fs.readFile(fixturePath);
const expectedPages = nearFreeCap ? 22 : caseName === "large" || caseName === "large-word" ? 8 : 4;
const expectedMarkers = Array.from({ length: expectedPages }, (_, page) =>
  `BENCH-P${String(page + 1).padStart(2, "0")}-R01`
);

function formForFixture() {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input)], { type: "application/pdf" }), fixtureName);
  return form;
}

async function validateOffice(bytes, kind) {
  if (bytes.subarray(0, 2).toString("ascii") !== "PK") throw new Error(`${kind}: ZIP signature missing`);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const partPrefix = { docx: "word/document.xml", xlsx: "xl/worksheets/", pptx: "ppt/slides/" }[kind];
  const parts = Object.keys(zip.files).filter((name) =>
    kind === "docx" ? name === partPrefix : name.startsWith(partPrefix) && name.endsWith(".xml")
  );
  if (!zip.file("[Content_Types].xml") || parts.length === 0) throw new Error(`${kind}: required parts missing`);
  const textParts = kind === "xlsx" ? ["xl/sharedStrings.xml", ...parts] : parts;
  const xml = (await Promise.all(textParts.map(async (name) => (await zip.file(name)?.async("string")) || ""))).join(" ");
  const plain = xml.replace(/<[^>]+>/g, "");
  const missingMarkers = expectedMarkers.filter((marker) => !plain.includes(marker));
  if (missingMarkers.length) throw new Error(`${kind}: editable page markers missing: ${missingMarkers.join(", ")}`);
  return { crcPassed: true, partCount: parts.length, editablePageMarkers: expectedMarkers.length };
}

async function runOffice(slug, kind) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/tools/${slug}`, {
    method: "POST", headers: { Origin: baseUrl }, body: formForFixture(), signal: AbortSignal.timeout(360_000),
  });
  if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const validation = await validateOffice(bytes, kind);
  return { tool: slug, elapsedMs: Math.round(performance.now() - started), outputBytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"), validation };
}

async function jsonOrThrow(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Word job HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function runWord() {
  const started = performance.now();
  const form = formForFixture();
  form.append("options", "{}");
  const response = await fetch(`${baseUrl}/api/tools/pdf-to-word`, {
    method: "POST", headers: { Origin: baseUrl, "X-Pdf-To-Word-Job": "1" },
    body: form, signal: AbortSignal.timeout(180_000),
  });
  const cookie = response.headers.get("set-cookie")?.match(/(?:^|,\s*)(pd_guest_session=[^;]+)/i)?.[1];
  const { jobId } = await jsonOrThrow(response);
  if (!cookie || !jobId) throw new Error("Word job ID or guest cookie missing");
  let status;
  for (let attempt = 0; attempt < 360; attempt += 1) {
    const result = await fetch(`${baseUrl}/api/tools/pdf-to-word/status?jobId=${encodeURIComponent(jobId)}`, {
      headers: { Origin: baseUrl, Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    status = await jsonOrThrow(result);
    if (status.status === "error") throw new Error(`Word conversion: ${status.error || "unknown error"}`);
    if (status.status === "done") break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (status?.status !== "done") throw new Error("Word job timed out after six minutes");
  const download = await fetch(`${baseUrl}/api/tools/pdf-to-word/download?jobId=${encodeURIComponent(jobId)}`, {
    headers: { Origin: baseUrl, Cookie: cookie }, signal: AbortSignal.timeout(30_000),
  });
  if (!download.ok) throw new Error(`Word download HTTP ${download.status}`);
  const bytes = Buffer.from(await download.arrayBuffer());
  if (process.env.PHASE2_SAVE_OUTPUT === "1") {
    await fs.writeFile(path.resolve("quality/phase2-production/generated", `${caseName}-word.docx`), bytes);
  }
  const validation = await validateOffice(bytes, "docx");
  const replay = await fetch(`${baseUrl}/api/tools/pdf-to-word/download?jobId=${encodeURIComponent(jobId)}`, {
    headers: { Origin: baseUrl, Cookie: cookie }, signal: AbortSignal.timeout(20_000),
  });
  if (replay.status !== 404) throw new Error(`Word download replay returned HTTP ${replay.status}, expected 404`);
  return { tool: "pdf-to-word", elapsedMs: Math.round(performance.now() - started), outputBytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"), engine: status.engine || null,
    oneTimeDownloadReplayStatus: replay.status, validation };
}

const startedAt = new Date().toISOString();
const results = [];
const attempts = caseName === "medium"
  ? [["pdf-to-word", runWord], ["pdf-to-excel", () => runOffice("pdf-to-excel", "xlsx")], ["pdf-to-ppt", () => runOffice("pdf-to-ppt", "pptx")]]
  : caseName === "large-word" ? [["pdf-to-word", runWord]]
  : caseName === "free-cap-word" ? [["pdf-to-word", runWord]]
  : caseName === "free-cap-excel" ? [["pdf-to-excel", () => runOffice("pdf-to-excel", "xlsx")]]
  : caseName === "free-cap-ppt" ? [["pdf-to-ppt", () => runOffice("pdf-to-ppt", "pptx")]]
  : [["pdf-to-excel", () => runOffice("pdf-to-excel", "xlsx")], ["pdf-to-ppt", () => runOffice("pdf-to-ppt", "pptx")]];
if (caseName === "above-free-cap") {
  const response = await fetch(`${baseUrl}/api/tools/pdf-to-excel`, {
    method: "POST", headers: { Origin: baseUrl }, body: formForFixture(), signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  results.push({ tool: "pdf-to-excel", status: response.status === 400 && /25\s*MB|too large|exceeds/i.test(body)
    ? "passed" : "failed", expectedStatus: 400, actualStatus: response.status,
  });
} else if (caseName === "parallel") {
  const parallel = await Promise.allSettled(attempts.map(([, run]) => run()));
  parallel.forEach((item, index) => results.push(item.status === "fulfilled"
    ? { status: "passed", ...item.value }
    : { status: "failed", tool: attempts[index][0], error: String(item.reason) }));
} else {
  for (const [tool, run] of attempts) {
    try { results.push({ status: "passed", ...(await run()) }); }
    catch (error) { results.push({ status: "failed", tool, error: String(error) }); }
  }
}

const report = { startedAt, completedAt: new Date().toISOString(), baseUrl, caseName,
  fixture: path.relative(process.cwd(), fixturePath).replace(/\\/g, "/"), inputBytes: input.length,
  note: "Synthetic mixed text/image fixture on one local development machine; no public-service, p95, universal-accuracy or 200 MB capacity claim.", results };
const reportPath = path.resolve("quality/phase2-production", `local-${caseName}-report.json`);
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (results.some((result) => result.status !== "passed")) process.exitCode = 1;
