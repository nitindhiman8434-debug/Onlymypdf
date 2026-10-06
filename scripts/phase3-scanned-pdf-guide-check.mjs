import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.GUIDE_BASE_URL || "http://127.0.0.1:3002");
assert(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  && base.pathname === "/" && !base.username && !base.password && !base.search && !base.hash,
"Only a loopback HTTP origin is allowed");

const guidePath = "/guides/scanned-pdf-to-word";
const title = "Scanned PDF to Word: OCR Guide";
const date = "2026-10-07";
const sourceUrl = "https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html";
// This crawler profile blocks metadata, but Next may still stream the page body.
// Resolve only real HTML segments explicitly linked to main's Suspense boundary.
const crawlerUserAgent = "Twitterbot/1.0";
const ordinaryUserAgent = "Mozilla/5.0 OnlyMyPDFLocalGuideVerifier/1.0";
const checks = [];
const responses = [];
const streamResolutions = [];
function check(name, validate) {
  try { validate(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, message: error.message }); }
}
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
async function request(route, audience = "ordinary") {
  assert(route.startsWith("/") && !route.startsWith("//"), "Only local route paths are allowed");
  const url = new URL(route, base);
  assert.equal(url.origin, base.origin, "Cross-origin requests are forbidden");
  const userAgent = audience === "html-limited-crawler" ? crawlerUserAgent : ordinaryUserAgent;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000), redirect: "error", headers: { "User-Agent": userAgent },
  });
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  responses.push({ route, audience, userAgent, status: response.status, contentType, bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex") });
  check(`${route} (${audience}): HTTP 200`, () => assert.equal(response.status, 200));
  return { body, contentType };
}

try {
  const { body: html, contentType } = await request(guidePath, "html-limited-crawler");
  const guideContent = resolveStreamedMain(html);
  const main = guideContent.markup;
  streamResolutions.push({ route: guidePath, linkedSegments: guideContent.linkedSegments });
  const visible = text(main);
  const schemas = [];
  let canonical = "";
  check("Guide returns rendered English HTML", () => {
    assert(contentType.includes("text/html"));
    assert(/<html\b[^>]*\blang="en"/i.test(html));
    assert(main, "Missing rendered main content");
    assert(/<h1\b/.test(main), "Resolved server markup still contains an incomplete main shell");
    assert(!html.includes("/_next/static/chunks/webpack.js"), "Use a production build, not the development server");
  });
  check("One canonical English guide URL", () => {
    const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
    const canonicals = tags.filter((tag) => attribute(tag, "rel") === "canonical");
    assert.equal(canonicals.length, 1);
    canonical = attribute(canonicals[0], "href");
    const url = new URL(canonical);
    assert(["http:", "https:"].includes(url.protocol));
    assert.equal(url.pathname, guidePath);
    assert(!url.search && !url.hash && !url.username && !url.password);
  });
  check("JSON-LD parses without duplicate Article or FAQ records", () => {
    for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      const value = JSON.parse(match[1]);
      schemas.push(...(Array.isArray(value) ? value : [value]));
    }
    assert.equal(schemas.filter((item) => item["@type"] === "Article").length, 1);
    assert.equal(schemas.filter((item) => item["@type"] === "FAQPage").length, 1);
  });
  check("Article identity, language and publication date match the canonical", () => {
    const article = schemas.find((item) => item["@type"] === "Article");
    assert(article);
    assert.equal(article.url, canonical);
    assert.equal(article["@id"], `${canonical}#article`);
    assert.equal(article.mainEntityOfPage["@id"], canonical);
    assert.equal(article.headline, title);
    assert.equal(article.inLanguage, "en");
    assert.equal(article.datePublished, date);
    assert.equal(article.dateModified, date);
    assert.equal(article.author.name, "OnlyMyPDF");
    assert.equal(article.author["@type"], "Organization");
    assert(article.citation.includes(sourceUrl));
  });
  check("Visible title and publication date match Article metadata", () => {
    const headings = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => text(match[1]));
    assert.deepEqual(headings, [title]);
    assert(visible.includes("Published 7 October 2026"));
    assert(new RegExp(`<time\\b[^>]*datetime="${date}"`, "i").test(main));
  });
  check("Breadcrumb ends at the guide without inventing a guides index", () => {
    const crumbs = schemas.find((item) => item["@type"] === "BreadcrumbList");
    assert(crumbs);
    assert.equal(crumbs.itemListElement.at(-1).item, canonical);
    assert(!links(main).some((link) => link.href === "/guides"));
  });
  check("Every visible FAQ question and answer matches its structured record exactly", () => {
    const faq = schemas.find((item) => item["@type"] === "FAQPage");
    const visibleFaqs = [...section(main, "guide-faq-heading")
      .matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((match) => ({
        question: text(match[1].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || ""),
        answer: text(match[1].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || ""),
      }));
    assert.equal(visibleFaqs.length, 5);
    assert.equal(new Set(visibleFaqs.map((item) => item.question)).size, 5);
    assert.deepEqual(faq.mainEntity.map((item) => ({ question: item.name, answer: item.acceptedAnswer.text })), visibleFaqs);
    assert(visibleFaqs.every((item) => item.question && item.answer));
  });
  check("Guide navigation links point to unique visible sections", () => {
    const ids = [...main.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ["choose-output", "conversion-steps", "table-support", "review-output", "common-problems"])
      assert(ids.includes(id), `Missing section ${id}`);
    for (const link of links(main).filter((item) => item.href.startsWith("#")))
      assert(ids.includes(link.href.slice(1)), `Broken guide anchor ${link.href}`);
  });
  check("Editable Word steps name the available workflow controls", () => {
    const steps = text(section(main, "conversion-steps"));
    for (const label of ["Select file", "Convert to Word", "Download DOCX", "no separate OCR switch or language selector"])
      assert(steps.includes(label), `Missing Word workflow detail: ${label}`);
  });
  check("Searchable PDF steps name language and download controls", () => {
    const steps = text(section(main, "conversion-steps"));
    for (const label of ["English under Document language", "Make PDF Searchable", "Download Searchable PDF"])
      assert(steps.includes(label), `Missing OCR workflow detail: ${label}`);
  });
  check("Scanner remains an image-based PDF step, not an OCR claim", () => {
    const choice = text(section(main, "choose-output"));
    assert(choice.includes("image-based PDF"));
    assert(choice.includes("It does not add searchable text"));
    assert(links(main).some((link) => link.href === "/pdf-scanner"));
  });
  check("Review guidance covers every page, editability and exact values", () => {
    const review = text(section(main, "review-output"));
    for (const phrase of ["Inspect every page", "first and last", "decimal points", "minus signs", "leading zeros", "clicking inside table cells", "test search and copy"])
      assert(review.includes(phrase), `Missing output review detail: ${phrase}`);
  });
  check("Both dated table results retain case counts and direct evidence links", () => {
    const tables = section(main, "table-support");
    assert.equal((text(tables).match(/4\/4 controlled cases passed/g) || []).length, 2);
    assert.equal((tables.match(/datetime="2026-10-06"/gi) || []).length, 2);
    const hrefs = links(tables).map((link) => link.href);
    for (const id of ["single-ruled-table", "two-ruled-tables"])
      assert(hrefs.includes(`/benchmarks#ocr-${id}`));
    assert(hrefs.includes("/benchmarks#ocr-results"));
  });
  check("Measured table support is bounded by controls and limitations", () => {
    const tables = text(section(main, "table-support"));
    for (const phrase of ["four-column grids", "Borderless memo controls", "merged cells", "side-by-side tables", "three tables on a page", "not an accuracy percentage", "customer acceptance", "not reproduced exactly"])
      assert(tables.includes(phrase), `Missing table limitation: ${phrase}`);
  });
  check("Preparation advice links its official source without promising a result", () => {
    assert(links(main).some((link) => link.href === sourceUrl));
    assert(visible.includes("do not guarantee a particular result"));
  });
  check("Guide HTML and streamed payload do not expose local report artifacts", () => {
    assert(!/C:(?:\\+|\/)|sourceSha256|outputDocxPath|sourcePreviewPaths|tmp(?:\\+|\/)pdfs|quality(?:\\+|\/)phase3-/i.test(html));
  });
  check("Guide offers the three existing English tool destinations", () => {
    const hrefs = links(main).map((link) => link.href);
    for (const destination of ["/pdf-to-word", "/ocr-pdf", "/pdf-scanner"]) assert(hrefs.includes(destination));
    assert(!hrefs.some((href) => href.startsWith("/hi/") || href.startsWith("/en/")));
  });
  check("Footer exposes one canonical English guide link", () => {
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] || "";
    assert.deepEqual(links(footer).filter((link) => link.href === guidePath), [
      { href: guidePath, label: "Scanned PDF guide" },
    ]);
  });

  // A separate ordinary response may use Next's streamed shell. Check every byte
  // for private artifacts without interpreting delayed scripts as visible copy.
  const ordinaryGuide = await request(guidePath);
  check("Ordinary streamed guide response does not expose local report artifacts", () => {
    assert(ordinaryGuide.contentType.includes("text/html"));
    assert(!/C:(?:\\+|\/)|sourceSha256|outputDocxPath|sourcePreviewPaths|tmp(?:\\+|\/)pdfs|quality(?:\\+|\/)phase3-/i.test(ordinaryGuide.body));
  });

  const { body: sitemap } = await request("/sitemap.xml");
  check("Sitemap lists one canonical guide with its actual publication date", () => {
    const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
      .filter((match) => match[1].includes("/guides/scanned-pdf-to-word"));
    assert.equal(entries.length, 1);
    assert(entries[0][1].includes(`<loc>${canonical}</loc>`));
    assert(/<lastmod>2026-10-07(?:T[^<]+)?<\/lastmod>/.test(entries[0][1]));
    assert(!/<loc>[^<]*\/guides\/?<\/loc>/.test(sitemap));
  });
  for (const route of ["/llms.txt", "/ai.txt"]) {
    const result = await request(route);
    check(`${route}: canonical guide discovery`, () => {
      assert(result.contentType.includes("text/plain"));
      assert(result.body.includes(`${title} — ${canonical}`));
      assert.equal(result.body.split(canonical).length, 2);
    });
  }
  const { body: benchmark } = await request("/benchmarks", "html-limited-crawler");
  check("Benchmarks links back to the guide in its main content", () => {
    const resolved = resolveStreamedMain(benchmark);
    const body = resolved.markup;
    streamResolutions.push({ route: "/benchmarks", linkedSegments: resolved.linkedSegments });
    assert(links(body).some((link) => link.href === guidePath));
    for (const id of ["ocr-results", "ocr-single-ruled-table", "ocr-two-ruled-tables"])
      assert(body.includes(`id="${id}"`), `Missing evidence target ${id}`);
  });
  for (const route of ["/pdf-to-word", "/ocr-pdf", "/pdf-scanner"]) {
    const result = await request(route);
    check(`${route}: destination renders as a page`, () => {
      assert(result.contentType.includes("text/html"));
      assert(/<h1\b/.test(result.body));
    });
  }
} catch (error) {
  checks.push({ name: "HTTP verification completed", passed: false, message: error.message });
}

const report = {
  phase: "3.3", checkedAt: new Date().toISOString(), baseUrl: base.origin,
  guidePath, method: "Read-only loopback HTTP checks against a production build. Guide and benchmark structure use actual server HTML, resolving main's Suspense templates through parsed top-level literal React transfer calls and balanced hidden HTML segments. An additional ordinary guide response is checked for private artifacts. No conversion requests or response-script execution.",
  responseStrategy: { crawlerUserAgent, ordinaryUserAgent,
    structuralScope: "Actual main HTML plus explicitly linked server HTML segments. TypeScript AST inspection accepts only top-level $RC calls with two string-literal arguments; scripts, styles and ordinary HTML comments are removed before segment extraction. Crawler metadata can block while the body still streams. RSC/JSON text cannot satisfy visible-content checks.",
    ordinaryScope: "HTTP status, content type and full raw-response privacy check" },
  limitations: ["Does not measure conversion accuracy, public hosting, search ranking or visual browser behavior; hydrated browser checks are separate evidence.", "The raw-path check is intended for a production build; development debug payloads are not supported.", "Frozen Phase 3.3 publication contract: 7 October 2026 guide, five FAQs and two 4/4 table snapshots dated 6 October 2026 UTC. Future publication changes require an intentional contract review."],
  responses, streamResolutions, checks, passed: checks.filter((item) => item.passed).length,
  total: checks.length, allPassed: checks.length > 0 && checks.every((item) => item.passed),
};
const directory = path.join(root, "quality/phase3-scanned-pdf-guide");
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, "http-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!report.allPassed) process.exitCode = 1;
