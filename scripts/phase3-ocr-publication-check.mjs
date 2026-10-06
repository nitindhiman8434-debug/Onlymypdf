import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.BENCHMARK_BASE_URL || "http://127.0.0.1:3001");
assert(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  && !base.username && !base.password && !base.search && !base.hash, "Only loopback HTTP is allowed");
const expected = [
  ["ocr-english-word", "2026-10-03", 4],
  ["ocr-ocr-page-geometry", "2026-10-03", 5],
  ["ocr-single-ruled-table", "2026-10-06", 4],
  ["ocr-two-ruled-tables", "2026-10-06", 4],
];
const checks = [];
function check(name, validate) {
  try { validate(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, message: error.message }); }
}
async function request(route) {
  const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(30_000), redirect: "error" });
  const body = await response.text();
  assert.equal(response.status, 200, `${route} must return HTTP 200`);
  return { body, contentType: response.headers.get("content-type") };
}
const { body: html, contentType } = await request("/benchmarks");
check("HTML response", () => assert(contentType?.includes("text/html")));
const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
const schemas = scripts.flatMap((match) => JSON.parse(match[1]));
const datasets = schemas.filter((item) => item["@type"] === "Dataset");
check("Five separate Dataset records", () => assert.equal(datasets.length, 5));
for (const [id, date, count] of expected) {
  check(`${id}: live evidence and structured data`, () => {
    assert(html.includes(`id="${id}"`), "Missing visible result anchor");
    const dataset = datasets.find((item) => item.url.endsWith(`#${id}`));
    assert(dataset, "Missing Dataset");
    assert.equal(dataset.dateModified, date);
    assert.deepEqual(dataset.variableMeasured.map((item) => item.value), [count, count]);
    assert.equal(dataset.variableMeasured[1].name, "Fixture cases in this test set");
    assert(dataset.description.length > 100, "Scope and limits must accompany the result");
  });
}
check("Historical baseline and stub disclosure retained", () => {
  assert.equal(datasets.find((item) => item.url.endsWith("#results-heading"))?.dateModified, "2026-10-03");
  assert(html.includes("does not measure Tesseract recognition accuracy"));
  assert(html.includes('id="document-corpus"'));
});
check("New controls and local limitations visible", () => {
  for (const text of ["not an accuracy percentage", "borderless memo control", "selectable memo", "Dates below use UTC", "not by customers"])
    assert(html.includes(text), `Missing scope: ${text}`);
});
check("No private report content in HTML or RSC payload", () => {
  assert(!/C:(?:\\|\/)|sourceSha256|outputDocxPath|sourcePreviewPaths|tmp\/pdfs|quality\/phase3-/.test(html));
});
check("OCR FAQ included in structured data", () => {
  const faq = schemas.find((item) => item["@type"] === "FAQPage");
  assert(faq?.mainEntity.some((question) => question.name === "Were scanned PDFs and editable Word tables tested?"));
});
const { body: sitemap } = await request("/sitemap.xml");
check("Benchmark sitemap modification date", () => {
  const entry = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .find((match) => /<loc>[^<]*\/benchmarks<\/loc>/.test(match[1]));
  assert(entry?.[1].includes("2026-10-07"));
});
const report = {
  phase: "3.2H", checkedAt: new Date().toISOString(), baseUrl: base.origin,
  method: "Read-only local HTTP HTML, JSON-LD, streamed payload and sitemap checks; no conversion requests",
  htmlBytes: Buffer.byteLength(html), htmlSha256: createHash("sha256").update(html).digest("hex"),
  checks, passed: checks.filter((item) => item.passed).length,
  total: checks.length, allPassed: checks.every((item) => item.passed),
};
const directory = path.join(root, "quality/phase3-ocr-publication");
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, "http-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!report.allPassed) process.exitCode = 1;
