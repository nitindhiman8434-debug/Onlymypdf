import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// This bounded publication check never uploads files or starts a server.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.SCANNER_BENCHMARK_BASE_URL || "http://127.0.0.1:3002");
assert(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  && base.pathname === "/" && !base.username && !base.password && !base.search && !base.hash,
"Only a loopback HTTP origin is allowed");
const checks = [];
const responses = [];
const streamResolutions = [];
const crawlerUserAgent = "Twitterbot/1.0";
const ordinaryUserAgent = "Mozilla/5.0 OnlyMyPDFScannerPublicationVerifier/1.0";
function check(name, validate) {
  try { validate(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, message: error.message }); }
}

// Kept local to this single-purpose checker. The bounded parser mirrors the
// reviewed Phase 3.3 approach; no response script is evaluated or executed.
function decode(value) {
  return value.replace(/&(?:#x([\da-f]+)|#(\d+)|(amp|lt|gt|quot|apos|nbsp));/gi,
    (_, hex, decimal, named) => hex ? String.fromCodePoint(parseInt(hex, 16))
      : decimal ? String.fromCodePoint(Number(decimal))
        : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[named.toLowerCase()]);
}
function text(markup) {
  return decode(markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ").trim();
}
function attribute(tag, name) {
  return decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] || "");
}
function links(markup) {
  return [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: attribute(match[1], "href"), label: text(match[2]) }));
}
function section(html, id) {
  return html.match(new RegExp(`<section\\b[^>]*(?:id|aria-labelledby)="${id}"[^>]*>([\\s\\S]*?)<\\/section>`, "i"))?.[1] || "";
}
function resolveStreamedMain(html) {
  const transfers = new Map();
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = attribute(script[1], "type");
    if (type && type !== "text/javascript" && type !== "application/javascript") continue;
    // Inspect only top-level literal call statements. The existing TypeScript
    // parser distinguishes calls from quoted strings, comments and function
    // bodies; no response JavaScript is evaluated or executed.
    const parsed = ts.createSourceFile("response.js", script[2], ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    assert.equal(parsed.parseDiagnostics.length, 0, "Malformed inline response script");
    for (const statement of parsed.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
      const call = statement.expression;
      if (!ts.isIdentifier(call.expression) || call.expression.text !== "$RC"
          || call.arguments.length !== 2 || !call.arguments.every(ts.isStringLiteral)) continue;
      const [boundary, segment] = call.arguments.map((argument) => argument.text);
      if (!boundary.startsWith("B:") || !segment.startsWith("S:")) continue;
      assert(!transfers.has(boundary), `Duplicate stream transfer for ${boundary}`);
      transfers.set(boundary, segment);
    }
  }
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, (comment) => /^<!--(?:\$[?!]?|\/\$)-->$/.test(comment) ? comment : "");
  const main = markup.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  assert(main !== undefined, "Missing actual main HTML");
  const linkedSegments = [];
  const used = new Set();
  function segmentContents(id) {
    const matches = [...markup.matchAll(/<div\b[^>]*>/gi)]
      .filter((match) => attribute(match[0], "id") === id);
    assert.equal(matches.length, 1, `Expected one actual hidden segment ${id}`);
    const opening = matches[0];
    assert(/\shidden(?:\s|=|>)/i.test(opening[0]), `Segment ${id} is not hidden server markup`);
    const start = opening.index + opening[0].length;
    const tags = /<div\b[^>]*>|<\/div\s*>/gi;
    tags.lastIndex = start;
    let depth = 1;
    for (let tag; (tag = tags.exec(markup));) {
      depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
      if (depth === 0) return markup.slice(start, tag.index);
    }
    throw new Error(`Unclosed hidden segment ${id}`);
  }
  function resolveBoundaries(content) {
    for (;;) {
      const template = content.match(/<template\b[^>]*\bid="(B:[^"]+)"[^>]*><\/template>/i);
      if (!template) return content;
      const boundary = template[1];
      assert(!used.has(boundary), `Duplicate or cyclic stream boundary ${boundary}`);
      used.add(boundary);
      const target = transfers.get(boundary);
      assert(target, `No literal React stream transfer for ${boundary}`);
      const start = content.lastIndexOf("<!--$?-->", template.index);
      assert(start >= 0 && /^<!--\$\?-->\s*$/.test(content.slice(start, template.index)),
        `Missing pending Suspense marker for ${boundary}`);
      const markers = /<!--(?:\$[?!]?|\/\$)-->/g;
      markers.lastIndex = start + "<!--$?-->".length;
      let depth = 1;
      let end = -1;
      for (let marker; (marker = markers.exec(content));) {
        depth += marker[0] === "<!--/$-->" ? -1 : 1;
        if (depth === 0) { end = marker.index + marker[0].length; break; }
      }
      assert(end >= 0, `Unclosed Suspense boundary ${boundary}`);
      const resolved = resolveBoundaries(segmentContents(target));
      linkedSegments.push({ boundary, segment: target });
      content = content.slice(0, start) + resolved + content.slice(end);
    }
  }
  return { markup: resolveBoundaries(main), linkedSegments };
}

function selfTestStreamExtraction() {
  const shell = '<main><!--$?--><template id="B:0"></template><p>Loading</p><!--/$--></main>';
  const segment = '<div hidden id="S:0"><section id="scanner-results"><div><h2>Scanner proof</h2></div></section></div>';
  const transfer = '<script>$RC("B:0","S:0")</script>';
  const resolved = resolveStreamedMain(shell + segment + transfer);
  assert.equal(resolved.markup, '<section id="scanner-results"><div><h2>Scanner proof</h2></div></section>');
  assert.deepEqual(resolved.linkedSegments, [{ boundary: "B:0", segment: "S:0" }]);
  assert.equal(resolveStreamedMain('<main><h1>Ready</h1></main>').markup, '<h1>Ready</h1>');
  assert.throws(() => resolveStreamedMain(shell + segment), /No literal React stream transfer/);
  assert.throws(() => resolveStreamedMain(shell + segment
    + '<script>const quoted = \'x;$RC("B:0","S:0")\';</script>'), /No literal React stream transfer/);
  assert.throws(() => resolveStreamedMain(shell + segment
    + '<script>function later(){$RC("B:0","S:0")}</script>'), /No literal React stream transfer/);
  assert.throws(() => resolveStreamedMain(shell + `<!--${segment}-->` + transfer), /Expected one actual hidden segment/);
  assert.throws(() => resolveStreamedMain(shell
    + `<script>self.__next_f.push([1,${JSON.stringify(segment)}]);$RC("B:0","S:0")</script>`), /Expected one actual hidden segment/);
  assert.throws(() => resolveStreamedMain(shell + segment.replace(" hidden", "") + transfer), /not hidden server markup/);
  return 8;
}

if (process.argv.includes("--self-test")) {
  console.log(JSON.stringify({ selfTests: selfTestStreamExtraction(), passed: true, networkRequests: 0 }));
  process.exit(0);
}

function assertPrivateEvidenceAbsent(markup) {
  assert(!/C:(?:\\+|\/)|sourceSha256|responseSha256|validatorSha256|outputDocxPath|sourcePreviewPaths|artifactContactSheetSha256|tmp(?:\\+|\/)pdfs|quality(?:\\+|\/)phase3-scanner/i.test(markup),
    "Local report fields, hashes or artifact paths leaked into the response");
  assert(!/https?:\\?\/\\?\/(?:127\.0\.0\.1|localhost):3001\b/i.test(markup),
    "Retained conversion-service URL leaked into the response");
  assert(!/i clicked on download pdf and saved/i.test(markup), "Private manual-save quote leaked into the response");
}

function schemasFromHtml(html) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, "");
  const schemas = [];
  for (const match of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attribute(match[1], "type") !== "application/ld+json") continue;
    const value = JSON.parse(match[2]);
    schemas.push(...(Array.isArray(value) ? value : [value]));
  }
  return schemas;
}

async function request(route, audience = "ordinary") {
  assert(route.startsWith("/") && !route.startsWith("//"), "Only relative local routes are allowed");
  const url = new URL(route, base);
  assert.equal(url.origin, base.origin, "Cross-origin requests are forbidden");
  const userAgent = audience === "html-limited-crawler" ? crawlerUserAgent : ordinaryUserAgent;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000), redirect: "error", headers: { "User-Agent": userAgent },
  });
  const body = await response.text();
  assert(Buffer.byteLength(body) <= 5 * 1024 * 1024, "Diagnostic HTML response exceeds 5 MiB");
  const contentType = response.headers.get("content-type") || "";
  responses.push({ route, audience, status: response.status, contentType, bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex") });
  check(`${route} (${audience}): HTTP 200 HTML`, () => {
    assert.equal(response.status, 200);
    assert(contentType.includes("text/html"));
  });
  return body;
}

try {
  check("Stream extraction rejects quoted, unbound, comment-only and RSC-only markup", () => assert.equal(selfTestStreamExtraction(), 8));
  const html = await request("/benchmarks", "html-limited-crawler");
  const resolved = resolveStreamedMain(html);
  streamResolutions.push({ route: "/benchmarks", linkedSegments: resolved.linkedSegments });
  const main = resolved.markup;
  const scanner = section(main, "scanner-results");
  const visible = text(scanner);
  const schemas = schemasFromHtml(html);
  const datasets = schemas.filter((item) => item["@type"] === "Dataset");
  const scannerDatasets = datasets.filter((item) => typeof item.url === "string" && item.url.endsWith("/benchmarks#scanner-results"));
  const scannerDataset = scannerDatasets[0];
  let canonical = "";

  check("Production English main contains exactly one actual Scanner section", () => {
    assert(/<html\b[^>]*\blang="en"/i.test(html));
    assert(/<h1\b/.test(main), "Resolved page remains an incomplete shell");
    assert(!html.includes("/_next/static/chunks/webpack.js"), "Use a production build, not the dev server");
    assert.equal((main.match(/<section\b[^>]*\bid="scanner-results"/gi) || []).length, 1);
    assert(scanner);
    assert.equal(text(scanner.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || ""),
      "PDF Scanner: image pages, filters and input limits");
  });
  check("Canonical remains the English benchmark URL", () => {
    const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
    const canonicals = tags.filter((tag) => attribute(tag, "rel") === "canonical");
    assert.equal(canonicals.length, 1);
    canonical = attribute(canonicals[0], "href");
    const url = new URL(canonical);
    assert(["http:", "https:"].includes(url.protocol));
    assert.equal(url.pathname, "/benchmarks");
    assert(!url.search && !url.hash && !url.username && !url.password);
  });
  check("Visible metrics keep conversions, invalid-input checks and output pages separate", () => {
    const metrics = [...scanner.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)]
      .map((match) => [text(match[1]), text(match[2])]);
    assert.deepEqual(metrics, [
      ["Image-to-PDF conversion cases passed", "5/5"],
      ["Invalid-input rejection checks passed", "6/6"],
      ["PDF output pages", "14"],
      ["Independently rendered PDF pages", "14"],
    ]);
    assert(visible.includes("They are not additional successful conversions."));
    assert(!visible.includes("This report needs review"));
  });
  check("All five positive and six negative cases have the correct individual outcome", () => {
    const positiveIds = ["original-color-png", "bw-gray-levels", "enhanced-low-contrast", "exif-6-upright-jpeg", "ten-mixed-pages-in-order"];
    const negativeIds = ["reject-eleven-images", "reject-unknown-filter", "reject-no-images", "reject-non-image", "reject-truncated-image", "reject-entire-mixed-corrupt-batch"];
    const articles = [...scanner.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)];
    assert.equal(articles.length, 11);
    for (const id of [...positiveIds, ...negativeIds]) {
      const matches = articles.filter((article) => attribute(article[1], "id") === `scanner-${id}`);
      assert.equal(matches.length, 1, `Missing or duplicate scanner case ${id}`);
      const outcome = text(matches[0][2].match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
      assert.equal(outcome, positiveIds.includes(id) ? "Passed" : "Rejected as expected");
      if (negativeIds.includes(id)) assert(text(matches[0][2]).includes("HTTP 400 JSON and no PDF artifact"));
    }
  });
  check("Visible measurement date remains 6 October 2026 UTC", () => {
    assert(visible.includes("6 October 2026 (UTC)"));
    assert(/<time\b[^>]*datetime="2026-10-06"/i.test(scanner));
  });
  check("Filter and orientation wording is limited to retained evidence", () => {
    for (const phrase of ["independent threshold of 128", "EXIF orientation-6", "not a camera-device test",
      "5th-to-95th percentile gray range increased from 49 to 201", "does not establish readability on every photo",
      "JPG, PNG and WebP"])
      assert(visible.includes(phrase), `Missing measured scanner detail: ${phrase}`);
  });
  check("Method and limitations prevent OCR, accuracy, camera or capacity overclaims", () => {
    for (const phrase of ["Pillow", "Poppler rendering at 96 DPI", "not a universal accuracy percentage",
      "without OCR", "Physical cameras", "animated images", "perspective correction",
      "ten maximum-size images", "production speed", "public availability"])
      assert(visible.includes(phrase), `Missing scanner boundary: ${phrase}`);
  });
  check("Scanner links lead to its tool and the existing English guide", () => {
    const hrefs = links(scanner).map((link) => link.href);
    assert(hrefs.includes("/pdf-scanner"));
    assert(hrefs.includes("/guides/scanned-pdf-to-word"));
    assert(!hrefs.some((href) => href.startsWith("/hi/") || href.startsWith("/en/")));
    assert(links(main).some((link) => link.href === "#scanner-results"));
  });
  check("Scanner anchors and labelled headings are unique in actual main markup", () => {
    const ids = [...main.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]);
    for (const id of ids.filter((value) => value.startsWith("scanner-")))
      assert.equal(ids.filter((value) => value === id).length, 1, `Duplicate scanner ID ${id}`);
    assert(ids.includes("scanner-results-heading"));
    assert(/<section\b[^>]*id="scanner-results"[^>]*aria-labelledby="scanner-results-heading"/i.test(main));
  });
  check("Six unique Dataset records preserve the five historical entries", () => {
    assert.equal(datasets.length, 6);
    assert.equal(new Set(datasets.map((item) => item["@id"])).size, 6);
    const expected = new Map([
      ["results-heading", "2026-10-03"],
      ["ocr-english-word", "2026-10-03"],
      ["ocr-ocr-page-geometry", "2026-10-03"],
      ["ocr-single-ruled-table", "2026-10-06"],
      ["ocr-two-ruled-tables", "2026-10-06"],
      ["scanner-results", "2026-10-06"],
    ]);
    for (const [id, date] of expected) {
      const matches = datasets.filter((item) => item["@id"] === `${canonical}#${id}`);
      assert.equal(matches.length, 1, `Missing dataset ${id}`);
      assert.equal(matches[0].url, matches[0]["@id"]);
      assert.equal(matches[0].dateModified, date);
      assert(main.includes(`id="${id}"`), `Dataset ${id} lacks a visible target`);
    }
    const baseline = datasets.find((item) => item["@id"] === `${canonical}#results-heading`);
    assert(baseline.description.includes("stub"));
    assert(text(main).includes("does not measure Tesseract recognition accuracy"));
  });
  check("Exactly one Scanner Dataset matches visible case and page counts", () => {
    assert.equal(scannerDatasets.length, 1);
    assert.equal(scannerDataset.dateModified, "2026-10-06");
    assert.equal(scannerDataset.url, `${canonical}#scanner-results`);
    const values = scannerDataset.variableMeasured.map((item) => [item.name, item.value]);
    assert.deepEqual(values, [
      ["Passed image-to-PDF conversion cases", 5],
      ["Image-to-PDF conversion cases tested", 5],
      ["Passed invalid-input rejection checks", 6],
      ["Invalid-input rejection checks tested", 6],
      ["PDF output pages", 14],
      ["Independently rendered PDF pages", 14],
    ]);
    assert(scannerDataset.description.includes("5/5 image-to-PDF conversion cases passed"));
    assert(scannerDataset.description.includes("6/6 invalid-input rejection checks passed"));
    assert(scannerDataset.description.includes("14 PDF output pages; 14 independently rendered pages"));
    assert(scannerDataset.description.includes("not a universal accuracy percentage"));
    assert(scannerDataset.description.includes("without OCR"));
    assert(scannerDataset.measurementTechnique.includes("Invalid uploads are tested separately"));
  });
  check("Scanner section and Dataset do not expose private evidence fields or hashes", () => {
    const output = scanner + JSON.stringify(scannerDataset);
    assertPrivateEvidenceAbsent(output);
    assert(!/\b[a-f0-9]{64}\b/i.test(output), "Raw report hash leaked into scanner content");
  });
  check("Full crawler HTML and streamed payload do not expose scanner artifacts or private confirmation", () => assertPrivateEvidenceAbsent(html));
  const ordinary = await request("/benchmarks");
  check("Ordinary benchmark HTML and streamed payload preserve evidence privacy", () => assertPrivateEvidenceAbsent(ordinary));
  for (const route of ["/pdf-scanner", "/guides/scanned-pdf-to-word"]) {
    const destination = await request(route, "html-limited-crawler");
    check(`${route}: existing destination has an actual page heading`, () => {
      const resolvedDestination = resolveStreamedMain(destination);
      assert(/<h1\b/.test(resolvedDestination.markup));
      if (route === "/pdf-scanner") {
        assert(links(resolvedDestination.markup).some((link) => link.href === "/benchmarks#scanner-results"
          && link.label === "PDF Scanner test results and limitations"), "Scanner page lacks its evidence link");
      }
      streamResolutions.push({ route, linkedSegments: resolvedDestination.linkedSegments });
    });
  }
} catch (error) {
  checks.push({ name: "Publication HTTP verification completed", passed: false, message: error.message });
}

const report = {
  phase: "3.5", checkedAt: new Date().toISOString(), baseUrl: base.origin,
  method: "Read-only loopback HTTP publication checks on a production build; no uploads, server start or response-script execution. Actual server HTML is resolved only through parsed top-level React transfer calls and bound hidden segments.",
  contract: { measuredOnIso: "2026-10-06", positiveCases: 5, negativeCases: 6, pdfPages: 14, datasets: 6 },
  limitations: ["This checks publication of retained evidence; it does not run conversions, certify OCR, camera devices, arbitrary image quality, production capacity, public availability or search ranking.",
    "Hydrated browser behavior and responsive visual inspection are separate checks.",
    "Frozen Phase 3.5 contract: changes to the retained corpus or visible/schema labels require intentional review of this checker."],
  responses, streamResolutions, checks,
  passed: checks.filter((item) => item.passed).length, total: checks.length,
  allPassed: checks.length > 0 && checks.every((item) => item.passed),
};
const directory = path.join(root, "quality/phase3-scanner-publication");
await mkdir(directory, { recursive: true });
const reportPath = path.join(directory, "http-report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ report: path.relative(root, reportPath).split(path.sep).join("/"),
  passed: report.passed, total: report.total, allPassed: report.allPassed,
  failures: checks.filter((item) => !item.passed) }));
if (!report.allPassed) process.exitCode = 1;
