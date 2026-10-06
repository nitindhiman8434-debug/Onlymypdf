# Phase 3.3: English scanned-PDF guide

**Date:** 7 October 2026

**Status:** Scoped local task complete. Public deployment remains deferred.

## Result

`/guides/scanned-pdf-to-word` explains when to choose editable Word or a
searchable PDF, the actual upload/conversion/download controls, tested ruled
table support, common problems and checks to perform on every output page.
The guide distinguishes PDF Scanner's image-based output from OCR.

The two table cards reuse the existing benchmark summaries: 4/4 controlled
cases in each retained test set, measured on 6 October 2026 UTC. Their control
files, synthetic scope and unsupported layouts are stated. These counts are
not universal accuracy percentages, new conversion measurements or customer
acceptance results.

The guide has matching Article, Breadcrumb and FAQ metadata, a canonical URL,
a dated sitemap entry, `llms.txt` and `ai.txt` discovery, a footer link and
reciprocal benchmark links. Five visible FAQ answers are the source of the
FAQ schema. The byline identifies OnlyMyPDF as an organization.

An older English PDF-to-Word key fact said scans might need OCR first. It now
explains that readable scans can use OCR automatically, consistent with the
tool and guide. No Hindi page, conversion implementation, dependency, cloud
configuration or paid deployment was changed.

## Verification

- 63/63 focused guide, evidence, JSON-LD, metadata, discovery and sitemap tests passed.
- ESLint passed for all 12 changed TypeScript files and the HTTP verifier.
- Next.js 16.3.6 webpack production build and TypeScript passed; 170/170 route
  entries were generated. The existing Google Fonts build dependency required
  network access; cloud integration values were blank or placeholders in the
  child environment. `.env.local` was not edited.
- Browser review passed at 390×844, 768×1024 and 1280×900. No horizontal overflow
  was found. Tool, section, benchmark and footer navigation worked. The scanner
  destination waited for development compilation before rendering successfully.
- No browser warning/error entries appeared in the inspected log. Screenshots
  were inspected in the task; no screenshot files are archived.
- Independent factual, SEO and accessibility review found no blocking issue.
  Its every-page review wording suggestion was applied.

The built-page HTTP check passed 35/35 gates across nine read-only requests:
metadata, matching visible FAQs, workflow labels, table evidence, links,
sitemap, text discovery and raw-response privacy. The checker resolves the
actual HTML segments linked to the initial `<main>` streaming boundary;
script/RSC text is not treated as visible content. Separate browser checks
verify the hydrated interface.

The first verifier read only the initial loading placeholder and missed the
content arriving later. A crawler user agent alone did not change this body
streaming behavior. Both diagnostic failures are retained as
`initial-streaming-http-report.json` and `crawler-streaming-http-report.json`.
Only the verification script needed correction; app rendering was unchanged.
Independent checker review also caught quoted JavaScript calls and commented-
out markup being accepted as stream evidence. Parsed top-level calls and
comment removal fixed both cases; the reviewer verified their rejection and
successful extraction of the actual page before the final 35/35 run.

The build retains existing middleware, cache-header and Buffer deprecation
notices. Built HTTP checks use a temporary loopback `next start` instance;
they do not validate deployment of the separate standalone package. This
phase does not establish public indexing, search rankings, production load,
retention, cost or conversion accuracy.

## Evidence and reproduction

Reports: `quality/phase3-scanned-pdf-guide/`.

```powershell
npm exec vitest run -- src/app/guides/scanned-pdf-to-word/page.test.ts src/lib/seo/marketing-aeo.test.ts src/lib/seo/routes.test.ts src/lib/seo/sitemap-dates.test.ts src/app/sitemap.test.ts src/app/benchmarks/ocr-results.test.ts src/config/ocr-benchmark.test.ts src/lib/seo/metadata.test.ts src/lib/seo/json-ld.test.ts
npm run build
# Serve the built app with an offline test configuration on loopback port 3002.
$env:GUIDE_BASE_URL = 'http://127.0.0.1:3002'
node scripts/phase3-scanned-pdf-guide-check.mjs
```

The verifier rejects non-loopback origins and redirects. It performs read-only
page requests, without uploads or conversion requests.

References used for the guide and metadata:
[Tesseract input quality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)
and [Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).
Product steps were checked against the actual local implementation.

## Next phase gate

**Proposed Phase 3.4: PDF Scanner output and limit consistency. Not started.**

1. Align scanner filter values: the workspace sends `original`, `bw`,
   `enhanced`, while the API recognizes `none`, `grayscale`, `blackwhite`,
   `highcontrast`, `brighten`. Verify the downloaded PDF pixels, not only
   the CSS preview. Relevant files: `src/components/tools/pdf-scanner/pdf-scanner-workspace.tsx`
   and `src/app/api/tools/pdf-scanner/route.ts`.
2. Align the FAQ and pre-submit validation with the API's 10-image limit.
   The current scanner page says users can add as many images as needed.
3. Correct unsupported perspective-correction, edge-detection and background-
   cleanup claims in English scanner descriptions and AEO content to match
   verified implementation behavior.

These pre-existing scanner issues do not invalidate the guide's narrower
image-based-PDF description. They remain open for the next scoped phase.
Real-customer feedback and deferred public launch gates remain separate.
