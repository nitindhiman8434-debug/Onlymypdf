import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Read-only, bounded publication checks; never starts a server or uploads files.
// Keep this explicit manifest aligned with ALL_PUBLIC_TOOL_SLUGS in seo/routes.ts.
const toolSlugs = [
  "merge-pdf", "split-pdf", "rotate-pdf", "delete-pdf", "extract-pdf", "compress-pdf",
  "pdf-to-word", "pdf-to-excel", "pdf-to-ppt", "word-to-pdf", "excel-to-pdf", "ppt-to-pdf",
  "jpg-to-pdf", "html-to-pdf", "txt-to-pdf", "edit-pdf", "sign-pdf", "add-watermark",
  "ai-pdf-summarizer", "pdf-scanner", "unlock-pdf", "protect-pdf", "repair-pdf", "ocr-pdf",
  "pdf-a", "redact-pdf", "crop-pdf", "compare-pdf",
];
const marketingRoutes = ["/", "/pricing", "/privacy", "/trust", "/terms", "/sla", "/status", "/faq", "/about", "/benchmarks", "/convert", "/all-tools"];
const htmlRoutes = [...toolSlugs.map((slug) => `/${slug}`), ...marketingRoutes];
const textRoutes = ["/llms.txt", "/ai.txt"];
const routes = [...htmlRoutes, ...textRoutes];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const responses = [];
const streamResolutions = [];
const evidence = [];
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
// The first run completed only 24 bodies inside 180 seconds. The reviewed
// 10-minute overall budget remains fixed as the manifest expands to 42 routes.
const RUN_TIMEOUT_MS = 600_000;

// This parser and its eight self-test scenarios are copied from the reviewed
// Phase 3.5 checker. Response scripts are parsed for literal transfers, never run.
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
    // Payload-only scripts cannot transfer an HTML segment. Preserve possible
    // escaped identifiers (e.g. \u0024RC) by parsing scripts containing \u too.
    // Quoted/commented/function-body $RC occurrences still go through the AST.
    if (!script[2].includes("$RC") && !script[2].includes("\\u")) continue;
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

function runParserSelfTests() {
  try {
    const passed = selfTestStreamExtraction();
    return { passed, total: 8, allPassed: passed === 8, networkRequests: 0 };
  } catch (error) {
    // Do not claim eight passes when an earlier assertion stopped the suite.
    return { passed: 0, total: 8, allPassed: false, networkRequests: 0, error: error.message };
  }
}

const parserSelfTests = runParserSelfTests();
if (process.argv.includes("--self-test")) {
  console.log(JSON.stringify({ parserSelfTests, routeChecks: { passed: 0, total: 0 }, networkRequests: 0 }));
  process.exit(parserSelfTests.allPassed ? 0 : 1);
}

const base = new URL(process.env.LAUNCH_CLAIMS_BASE_URL || "http://127.0.0.1:3002");
assert(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  && base.pathname === "/" && !base.username && !base.password && !base.search && !base.hash,
"Only a loopback HTTP origin is allowed");
assert.equal(toolSlugs.length, 28);
assert.equal(new Set(routes).size, 42, "The frozen route manifest must contain 42 unique routes");
const deadline = Date.now() + RUN_TIMEOUT_MS;

function check(route, name, validate) {
  try { validate(); checks.push({ route, name, passed: true }); return true; }
  catch (error) { checks.push({ route, name, passed: false, message: error.message }); return false; }
}

async function request(route, kind) {
  const started = Date.now();
  const record = { route, audience: "html-limited-crawler", requested: false, status: null,
    contentType: null, bytes: 0, sha256: null, bodyComplete: false,
    timeToHeadersMs: null, bodyReadMs: null, durationMs: null };
  responses.push(record);
  let digest;
  try {
    assert(route.startsWith("/") && !route.startsWith("//"), "Only relative local routes are allowed");
    const url = new URL(route, base);
    assert.equal(url.origin, base.origin, "Cross-origin requests are forbidden");
    const remaining = deadline - Date.now();
    assert(remaining > 0, "Overall request time budget exhausted");
    record.requested = true;
    const response = await fetch(url, {
      method: "GET", credentials: "omit", redirect: "error",
      signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, remaining))),
      headers: { "User-Agent": "Twitterbot/1.0" },
    });
    record.timeToHeadersMs = Date.now() - started;
    record.status = response.status;
    record.contentType = response.headers.get("content-type") || "";
    const chunks = [];
    digest = createHash("sha256");
    assert(response.body, "Missing response body stream");
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        record.bytes += value.byteLength;
        digest.update(value);
        if (record.bytes > MAX_BODY_BYTES) {
          await reader.cancel();
          throw new Error("Diagnostic response exceeds 5 MiB");
        }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    record.sha256 = digest.digest("hex");
    digest = undefined;
    record.bodyComplete = true;
    const body = Buffer.concat(chunks).toString("utf8");
    const validResponse = check(route, `HTTP 200 ${kind}`, () => {
      assert.equal(record.status, 200);
      assert(record.contentType.toLowerCase().includes(kind === "HTML" ? "text/html" : "text/plain"));
      assert(record.bytes > 0, "Empty response body");
    });
    return validResponse ? body : null;
  } catch (error) {
    if (digest) record.sha256 = digest.digest("hex");
    record.error = error.message;
    checks.push({ route, name: "Request and bounded body read completed", passed: false, message: error.message });
    return null;
  } finally {
    record.durationMs = Date.now() - started;
    if (record.timeToHeadersMs !== null) record.bodyReadMs = record.durationMs - record.timeToHeadersMs;
  }
}

function metadataFromHtml(html) {
  // Removing all scripts prevents metadata strings inside React payloads from
  // masquerading as rendered tags. JSON-LD is inspected separately below.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const title = text(markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const tags = [...markup.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const descriptions = tags.filter((tag) => /^(?:description|og:description|twitter:description)$/i
    .test(attribute(tag, "name") || attribute(tag, "property")))
    .map((tag) => attribute(tag, "content"));
  const description = tags.find((tag) => attribute(tag, "name").toLowerCase() === "description");
  const canonicalTags = [...markup.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0]).filter((tag) => attribute(tag, "rel").toLowerCase() === "canonical");
  return { title, descriptions, description: description ? attribute(description, "content") : "",
    canonicals: canonicalTags.map((tag) => attribute(tag, "href")) };
}

function schemaStrings(value) {
  if (typeof value === "string") return [text(value)];
  if (Array.isArray(value)) return value.flatMap(schemaStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(schemaStrings);
  return [];
}

function schemaObjects(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(schemaObjects);
  return [value, ...Object.values(value).flatMap(schemaObjects)];
}

// These expressions target the audited assertions, not isolated words such as
// "seconds", "bookmarks" or "every page" in limitations or benchmark results.
const disallowedClaims = [
  ["absolute TXT preservation", /\bNo text content is ever lost or cut off\b/i],
  ["client-only processing", /\bWorks entirely in your browser\b/i],
  ["unsupported typical compression ranges", /\b(?:40\s*[-–—]\s*80|10\s*[-–—]\s*30)\s*(?:%|percent\b)/i],
  ["crisp text guarantee", /\bkeeps? (?:your )?text crisp\b/i],
  ["blanket bookmark preservation", /\b(?:preserves? (?:all |original )?(?:[^.!?]{0,50}and )?bookmarks|bookmarks (?:are |will be )?(?:fully |always )?preserved)\b/i],
  ["HTML URL input", /\b(?:paste (?:a |the )?(?:web(?:site|page)? )?URL|from files or URLs|URL or file input|HTML to PDF converts web pages and HTML files)\b/i],
  ["Pro-only AI access", /\b(?:AI (?:PDF )?(?:summari[sz]er|summari[sz]ation)[^.!?]{0,65}(?:requires? (?:a )?Pro|only (?:available )?(?:on|for|to) Pro)|(?:log|sign) in with a Pro account|summari[sz]er is a Pro feature)\b/i],
  ["absolute physical deletion deadline", /\bnever keep (?:your )?files beyond\b/i],
  ["AI reads all pages", /\b(?:AI |summari[sz]er )?reads every page\b/i],
  ["instant output promise", /\b(?:instant (?:summaries|conversion|conversions|results)|(?:extract pages|reduce file size|download(?: your single merged PDF| the result)?) instantly)\b/i],
  ["generic seconds promise", /\b(?:in (?:just |a few )?seconds|(?:most documents are summarized|summari[sz]es? (?:your )?PDF)[^.!?]{0,50}\b(?:10\s*[-–—]\s*30|seconds))\b/i],
];

function assertAuditedClaimsAbsent(content) {
  // The shared marketing shell describes tool navigation, not conversion
  // throughput. Exempt exactly that sentence; all output-speed checks remain.
  content = content.replace(/\bPick a tool and start in seconds\./g, "");
  for (const [label, pattern] of disallowedClaims) {
    for (const match of content.matchAll(new RegExp(pattern.source, "gi"))) {
      const before = content.slice(Math.max(0, match.index - 100), match.index);
      const after = content.slice(match.index + match[0].length, match.index + match[0].length + 80);
      // Explicitly negated promises are limitations, not claims. Keep the
      // qualification attached to this match instead of exempting whole pages.
      const negated = /(?:\b(?:do|does|will|can) not|\bcannot|\bcan['’]t|\bdoesn['’]t|\bdon['’]t|\bno guarantee (?:that|to)|\bnot guaranteed to)\s*$/i.test(before)
        || /^\s+(?:is|are) not (?:guaranteed|promised|supported)\b/i.test(after);
      assert(negated, `Audited unsupported claim (${label}): ${match[0]}`);
    }
  }
}

function hasImageCap(content, cap) {
  return new RegExp(`\\b(?:up to|maximum(?: of)?|limit(?: of)?)\\s+${cap}\\s+(?:camera captures or )?(?:JPG,? PNG,? and WebP )?images?\\b`, "i").test(content)
    || new RegExp(`\\b${cap}\\s+(?:camera captures or JPG, PNG, and WebP uploads|images? total)\\b`, "i").test(content);
}

function checkRouteDetails(route, main, visible, schemas, metadata) {
  const schemaText = schemaStrings(schemas).join(" ");
  const combined = `${visible} ${schemaText}`;
  if (["/privacy", "/trust", "/terms", "/sla"].includes(route)) {
    check(route, "Visible legal revision date is 9 October 2026", () => {
      assert(/\b(?:9 October 2026|October 9,? 2026|2026-10-09)\b/.test(visible));
    });
  }
  if (route === "/jpg-to-pdf" || route === "/pdf-scanner") {
    const cap = route === "/jpg-to-pdf" ? 20 : 10;
    check(route, `Visible image cap is ${cap}`, () => assert(hasImageCap(visible, cap)));
    check(route, `JSON-LD image cap is ${cap}`, () => assert(hasImageCap(schemaText, cap)));
    check(route, "No higher Pro image allowance is advertised", () => {
      assert(!/(?:50 (?:images|for Pro)|images\s*\(50|Pro[^.!?]{0,40}(?:50|unlimited) images)/i.test(combined));
    });
  }
  if (route === "/compress-pdf") check(route, "Compression explains Basic, Strong and variable results", () => {
    assert(/\bBasic\b/i.test(visible) && /\blossless\b/i.test(visible));
    assert(/\bStrong\b/i.test(visible) && /\brasteriz/i.test(visible));
    assert(/(?:savings|reductions?|results?)[^.!?]{0,60}(?:vary|depend)|(?:vary|depend)[^.!?]{0,60}(?:document|content)/i.test(visible));
  });
  if (route === "/html-to-pdf") check(route, "HTML input and external-resource limits are stated", () => {
    assert(/upload(?:ed)?[^.!?]{0,45}HTML (?:file|document)/i.test(visible));
    assert(/(?:URL input is not supported|file input only)/i.test(combined));
    assert(/scripts? and external[^.!?]{0,40}(?:blocked|disabled)/i.test(combined));
  });
  if (route === "/ai-pdf-summarizer") check(route, "Free AI access is stated in visible content and schema", () => {
    for (const content of [visible, schemaText])
      assert(/(?:Free[^.!?]{0,80}1 (?:AI )?summary (?:per day|\/day)|1 free summary\s*\/\s*day)/i.test(content));
  });
  if (route === "/status") check(route, "Status description and visible explanation limit the check", () => {
    assert(/application response/i.test(metadata.description));
    assert(/basic configuration/i.test(metadata.description));
    assert(/does not verify[^.!?]{0,140}conversion results/i.test(visible));
    for (const boundary of ["storage", "worker health", "cleanup", "historical uptime"])
      assert(visible.includes(boundary), `Missing status boundary: ${boundary}`);
  });
  if (route === "/pricing") {
    check(route, "Pricing offers qualify checkout and avoid unconditional InStock", () => {
      const objects = schemaObjects(schemas);
      const products = objects.filter((item) => item["@type"] === "Product");
      const offers = objects.filter((item) => item["@type"] === "Offer");
      assert(products.length > 0, "Missing pricing Product JSON-LD");
      assert(offers.length > 0, "Missing pricing Offer JSON-LD");
      assert(products.some((item) => /checkout[^.!?]{0,60}(?:availability|available)/i.test(item.description || "")),
        "Missing checkout availability qualification from Product description");
      assert(!objects.some((item) => typeof item.availability === "string" && /(?:\/|^)InStock$/i.test(item.availability)),
        "Pricing schema unconditionally advertises InStock");
    });
    check(route, "Business card qualifies Sales agreement and has no fixed 20+ seat badge", () => {
      const heading = [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
        .find((match) => text(match[1]) === "Business");
      assert(heading, "Actual rendered Business card is absent; client payload is not HTML evidence");
      const sales = [...main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
        .find((match) => match.index > heading.index && attribute(match[1], "href") === "/contact?subject=business");
      assert(sales && /Contact Sales/i.test(text(sales[2])), "Missing Business Contact Sales link");
      const business = text(main.slice(heading.index, sales.index + sales[0].length));
      assert(!/\b20\s*\+/.test(business), "Business card advertises a fixed 20+ seat entitlement");
      assert(/(?:agreed with|agreement with|discuss[^.!?]{0,60}with) Sales/i.test(business), "Business card lacks Sales qualification");
      assert(/organization access/i.test(business) && /seat counts?/i.test(business) && /API activation/i.test(business),
        "Missing Business activation scope");
      assert(/(?:depend|subject)[^.!?]{0,100}(?:proposal|agreement|Sales)/i.test(business), "Business activation is not qualified");
      assert(/(?:payment|invoicing) terms[^.!?]{0,70}(?:Sales|agreement)/i.test(business), "Missing qualified Business payment terms");
      assert(/support[^.!?]{0,70}(?:Sales|agreement)/i.test(business), "Missing qualified Business support arrangements");
    });
  }
  if (route === "/faq") check(route, "Collapsed FAQ answers are inspected from actual FAQPage JSON-LD", () => {
    const faq = schemas.filter((item) => item["@type"] === "FAQPage");
    assert.equal(faq.length, 1, "Expected one actual FAQPage schema");
    assert(Array.isArray(faq[0].mainEntity) && faq[0].mainEntity.length >= 20, "Missing FAQ answers");
    const answers = faq[0].mainEntity.map((item) => {
      assert.equal(item["@type"], "Question");
      assert(item.name && item.acceptedAnswer?.text, "Empty FAQ question or answer");
      return item.acceptedAnswer.text;
    }).join(" ");
    assert(/100,?000 characters/i.test(answers) && /truncat/i.test(answers));
    assert(/Free[^.!?]{0,80}1 summary per day/i.test(answers));
    assert(/physical deletion[^.!?]{0,100}(?:cleanup|delay)/i.test(answers));
    evidence.push({ route, faqAnswers: faq[0].mainEntity.length });
  });
  if (route === "/benchmarks") checkBenchmarks(route, main, schemas, metadata);
}

function checkBenchmarks(route, main, schemas, metadata) {
  const scanner = section(main, "scanner-results");
  check(route, "Scanner retains separate 5/5 positive, 6/6 rejection and 14-page metrics", () => {
    assert(scanner, "Missing actual Scanner section");
    const metrics = [...scanner.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)]
      .map((match) => [text(match[1]), text(match[2])]);
    assert.deepEqual(metrics, [
      ["Image-to-PDF conversion cases passed", "5/5"],
      ["Invalid-input rejection checks passed", "6/6"],
      ["PDF output pages", "14"],
      ["Independently rendered PDF pages", "14"],
    ]);
    assert(text(scanner).includes("They are not additional successful conversions."));
    assert(links(scanner).some((link) => link.href === "/pdf-scanner"));
  });
  check(route, "Scanner retains all five positive and six negative case outcomes", () => {
    const positive = ["original-color-png", "bw-gray-levels", "enhanced-low-contrast", "exif-6-upright-jpeg", "ten-mixed-pages-in-order"];
    const negative = ["reject-eleven-images", "reject-unknown-filter", "reject-no-images", "reject-non-image", "reject-truncated-image", "reject-entire-mixed-corrupt-batch"];
    const articles = [...scanner.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)];
    assert.equal(articles.length, 11);
    for (const id of [...positive, ...negative]) {
      const matches = articles.filter((article) => attribute(article[1], "id") === `scanner-${id}`);
      assert.equal(matches.length, 1, `Missing or duplicate Scanner case ${id}`);
      const outcome = text(matches[0][2].match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
      assert.equal(outcome, positive.includes(id) ? "Passed" : "Rejected as expected");
      if (negative.includes(id)) assert(text(matches[0][2]).includes("HTTP 400 JSON and no PDF artifact"));
    }
  });
  check(route, "Six Dataset records and retained measurement dates are preserved", () => {
    assert.equal(metadata.canonicals.length, 1);
    const canonical = metadata.canonicals[0];
    const datasets = schemas.filter((item) => item["@type"] === "Dataset");
    assert.equal(datasets.length, 6);
    assert.equal(new Set(datasets.map((item) => item["@id"])).size, 6);
    const expected = new Map([
      ["results-heading", "2026-10-03"], ["ocr-english-word", "2026-10-03"],
      ["ocr-ocr-page-geometry", "2026-10-03"], ["ocr-single-ruled-table", "2026-10-06"],
      ["ocr-two-ruled-tables", "2026-10-06"], ["scanner-results", "2026-10-06"],
    ]);
    for (const [id, date] of expected) {
      const matches = datasets.filter((item) => item["@id"] === `${canonical}#${id}`);
      assert.equal(matches.length, 1, `Missing dataset ${id}`);
      assert.equal(matches[0].url, matches[0]["@id"]);
      assert.equal(matches[0].dateModified, date);
      assert(main.includes(`id="${id}"`), `Dataset ${id} lacks a visible target`);
    }
    const scannerDataset = datasets.find((item) => item.url === `${canonical}#scanner-results`);
    assert.deepEqual(scannerDataset.variableMeasured.map((item) => [item.name, item.value]), [
      ["Passed image-to-PDF conversion cases", 5], ["Image-to-PDF conversion cases tested", 5],
      ["Passed invalid-input rejection checks", 6], ["Invalid-input rejection checks tested", 6],
      ["PDF output pages", 14], ["Independently rendered PDF pages", 14],
    ]);
    assert(scannerDataset.description.includes("not a universal accuracy percentage"));
    assert(scannerDataset.description.includes("without OCR"));
    evidence.push({ route, datasets: 6, scannerPositiveCases: 5, scannerNegativeCases: 6, scannerOutputPages: 14, scannerRenderedPages: 14 });
  });
}

for (const route of htmlRoutes) {
  const html = await request(route, "HTML");
  if (html === null) continue;
  const inspectionStarted = Date.now();
  try {
    const parserStarted = Date.now();
    const resolved = resolveStreamedMain(html);
    streamResolutions.push({ route, durationMs: Date.now() - parserStarted, linkedSegments: resolved.linkedSegments });
    const main = resolved.markup;
    const visible = text(main);
    check(route, "Actual English production main has a nonempty H1 and content", () => {
      assert(/<html\b[^>]*\blang="en"/i.test(html));
      const headings = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => text(match[1]));
      assert.equal(headings.length, 1, "Expected one actual main H1");
      assert(headings[0].length > 0 && visible.length > 80, "Main is empty or an incomplete shell");
      assert(!html.includes("/_next/static/chunks/webpack.js"), "Use a production build, not the dev server");
      evidence.push({ route, h1: headings[0], mainTextCharacters: visible.length });
    });
    const metadata = metadataFromHtml(html);
    check(route, "Actual title, description and English canonical are present", () => {
      assert(metadata.title && metadata.description, "Missing rendered metadata");
      assert.equal(metadata.canonicals.length, 1);
      const canonical = new URL(metadata.canonicals[0]);
      assert(["http:", "https:"].includes(canonical.protocol));
      assert.equal(canonical.pathname.replace(/\/$/, "") || "/", route);
      assert(!canonical.username && !canonical.password && !canonical.search && !canonical.hash);
    });
    const schemas = schemasFromHtml(html);
    check(route, "Actual JSON-LD is valid and nonempty", () => assert(schemas.length > 0));
    for (const [channel, content] of [
      ["main text", visible], ["metadata", [metadata.title, ...metadata.descriptions].join(" ")],
      ["JSON-LD", schemaStrings(schemas).join(" ")],
    ]) check(route, `Audited unsupported claims absent from ${channel}`, () => assertAuditedClaimsAbsent(content));
    checkRouteDetails(route, main, visible, schemas, metadata);
  } catch (error) {
    checks.push({ route, name: "Actual response extraction completed", passed: false, message: error.message });
  } finally {
    responses.find((item) => item.route === route).inspectionMs = Date.now() - inspectionStarted;
  }
}

for (const route of textRoutes) {
  const body = await request(route, "plain text");
  if (body === null) continue;
  check(route, "Machine guide contains all 28 public tool URLs", () => {
    assert(body.startsWith("#") && body.includes("OnlyMyPDF"));
    for (const slug of toolSlugs) {
      const pattern = new RegExp(`https?://[^\\s/]+/${slug}(?=[\\s#?]|$)`);
      assert(pattern.test(body), `Missing ${slug} URL`);
    }
  });
  check(route, "Audited unsupported claims absent from machine guide", () => assertAuditedClaimsAbsent(body));
  check(route, "Machine guide preserves distinct image caps and Free AI access", () => {
    const toolLine = (slug) => body.split(/\r?\n/).find((line) => new RegExp(`/${slug}(?:\\s|$)`).test(line)) || "";
    assert(hasImageCap(toolLine("jpg-to-pdf"), 20), "Missing JPG-to-PDF 20-image cap");
    assert(hasImageCap(toolLine("pdf-scanner"), 10), "Missing Scanner 10-image cap");
    assert(/Free[^.!?]{0,80}1 (?:AI )?summary (?:per day|\/day)/i.test(toolLine("ai-pdf-summarizer")), "Missing Free AI allowance");
    assert(/cleanup[^.!?]{0,80}(?:delay|longer)|(?:delay|longer)[^.!?]{0,80}cleanup/i.test(body), "Missing cleanup qualification");
  });
}

const routeResults = routes.map((route) => {
  const routeChecks = checks.filter((item) => item.route === route);
  const response = responses.find((item) => item.route === route);
  return { route, kind: textRoutes.includes(route) ? "plain text" : "HTML", requested: Boolean(response?.requested),
    passed: routeChecks.filter((item) => item.passed).length, total: routeChecks.length,
    allPassed: Boolean(response?.bodyComplete) && routeChecks.length > 0 && routeChecks.every((item) => item.passed) };
});
const report = {
  phase: "3.6", checkedAt: new Date().toISOString(), baseUrl: base.origin,
  method: "Read-only sequential loopback GETs against an existing production build. No uploads, credentials, server starts, response-script execution or conversion runs. Claims are checked only in actual resolved main HTML, rendered metadata, actual JSON-LD script elements and plain-text machine guides; React payload strings are excluded.",
  bounds: { requestTimeoutMs: REQUEST_TIMEOUT_MS, totalRequestBudgetMs: RUN_TIMEOUT_MS, maxResponseBytes: MAX_BODY_BYTES, redirectPolicy: "error" },
  contract: { toolRoutes: 28, marketingHtmlRoutes: 12, totalHtmlRoutes: 40, machineGuides: 2, legalRevisionDate: "2026-10-09", jpgToPdfMaxImages: 20, scannerMaxImages: 10,
    retainedScannerPositiveCases: 5, retainedScannerNegativeCases: 6, retainedScannerOutputPages: 14, retainedScannerRenderedPages: 14, retainedDatasets: 6 },
  limitations: [
    "These are publication consistency assertions, not new engine, output-artifact, privacy-control, TLS, payment, uptime or deployment verification.",
    "Hydrated interactions, the status health label, collapsed FAQ UI behavior and responsive screenshots require separate browser checks.",
    "Only the 42 explicit English routes are requested; translations, private routes, authenticated state, API health and external links are not exercised.",
    "Negative checks target the audited claims and are not an exhaustive semantic review of every possible claim. Benchmark counts are retained evidence, not fresh conversions.",
    "Request or extraction errors are failures; skipped assertions after such failures are not counted as passes. Parser self-tests are reported separately from route checks.",
  ],
  parserSelfTests,
  responseCounts: { planned: routes.length, requested: responses.filter((item) => item.requested).length,
    complete: responses.filter((item) => item.bodyComplete).length, completeBodyHashes: responses.filter((item) => item.bodyComplete && item.sha256).length,
    totalBytes: responses.reduce((sum, item) => sum + item.bytes, 0) },
  routeCounts: { passed: routeResults.filter((item) => item.allPassed).length, total: routeResults.length },
  routeChecks: { passed: checks.filter((item) => item.passed).length, total: checks.length },
  routeResults, responses, streamResolutions, evidence, checks,
  allPassed: parserSelfTests.allPassed && routeResults.every((item) => item.allPassed),
};
const directory = path.join(root, "quality/phase3-launch-claims");
await mkdir(directory, { recursive: true });
const reportPath = path.join(directory, "http-report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ report: path.relative(root, reportPath).split(path.sep).join("/"),
  parserSelfTests, responseCounts: report.responseCounts, routeCounts: report.routeCounts, routeChecks: report.routeChecks,
  allPassed: report.allPassed, failures: checks.filter((item) => !item.passed) }));
if (!report.allPassed) process.exitCode = 1;
