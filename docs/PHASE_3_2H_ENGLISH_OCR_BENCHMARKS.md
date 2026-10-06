# Phase 3.2H: publish the English OCR evidence locally

**Date:** 7 October 2026

**Status:** Scoped local task complete. Public deployment remains deferred.

## Result

The English `/benchmarks#ocr-results` page now explains the four retained OCR
test sets from 3.2D–G. Visitors can compare editable text, searchable page
appearance, one ruled table per page and two tables on a page. Every result
includes its measurement date, fixture composition, checks and limits, with
links to PDF to Word or OCR PDF.

The original two-page Office baseline, its 3 October measurement and its
searchable-input stub disclosure remain intact. The separate language and
document corpus is retained. No Hindi page, conversion engine, dependency,
cloud setting or paid deployment was changed.

## Published evidence

| Dated test set | Fixture result | What the denominator includes |
| --- | --- | --- |
| English editable Word, 3 October 2026 UTC | 4/4 | Three scans and one selectable memo control |
| Searchable PDF geometry, 3 October 2026 UTC | 5/5 | Seven output pages, including an already-searchable control |
| One ruled table per page, 6 October 2026 UTC | 4/4 | Three invoice cases and one borderless memo control; five output pages |
| Two ruled tables on one page, 6 October 2026 UTC | 4/4 | Three two-table scans and one borderless two-group control; four output pages |

The 6 October UTC timestamps correspond to 7 October in India. Dates are
explicitly labeled UTC on the page. Repeat regression runs are not added to the
fixture totals. No accuracy percentage, production speed, customer acceptance or
universal layout-fidelity claim is made. Borderless controls demonstrate that
the converter did not invent tables, not that borderless table extraction works.

## Implementation

- `src/config/ocr-benchmark.ts` privately reads retained JSON evidence and exports
  compact public summaries. Counts come from individual source, HTTP, document
  and render gates, not an optimistic aggregate pass label. Missing, duplicate,
  failed or unverified results cannot silently become passes.
- `src/app/benchmarks/ocr-results.tsx` renders the server-side section and four
  matching Dataset records from the same summaries. No raw report object is
  passed to a client component. Visible and structured dates/counts stay aligned.
- The page adds in-page navigation and an OCR FAQ. The historical baseline keeps
  a separate Dataset with its original date. All five Dataset URLs resolve to
  visible anchors. The sitemap's page modification date is 7 October 2026.
- Source/output paths, hashes and synthetic document contents are excluded from
  the public summary. Production HTML and its streamed component payload were
  checked for raw report fields and local machine paths.

## Validation

| Check | Result |
| --- | --- |
| Evidence contract, mutation, date and visual-report binding tests | 38/38 passed |
| Rendering, JSON-LD, historical baseline and existing SEO/sitemap tests | 14/14 passed |
| Focused ESLint | Passed for all six changed TypeScript files |
| Production build | Next.js 16.3.6 webpack build passed, including TypeScript and 169/169 generated route entries |
| Built-page HTTP, metadata, sitemap and payload checks | 11/11 passed on temporary loopback port 3002 |
| Responsive browser review | Passed at 390×844, 768×1024 and 1280×900; no page/card horizontal overflow |
| Navigation | OCR section anchor, PDF to Word and OCR PDF destinations verified |
| Browser console | No warning/error entries in the inspected tab |
| Independent review | No blocking findings; denominator wording corrected to include unverified cases truthfully |

The build initially could not retrieve the existing Google Fonts assets inside
the restricted network sandbox. Re-running with network access passed. A strict
HTTP privacy check on the development server saw Next.js development stack-trace
paths; the built production response passed the unchanged check. Both reports
are retained so this distinction is not hidden. The temporary built server was
stopped after verification; the existing offline preview remains on port 3001.

The built-page check used `next start` to validate the built route locally. It
does not validate deployment of the separate standalone package. Existing
middleware, cache-header and Buffer deprecation notices were not introduced by
this change. Browser screenshots were inspected in the task; no screenshot
files are archived with the reports.

## Evidence and reproduction

Results live under `quality/phase3-ocr-publication/`: `unit-report.json`,
`http-report.json`, `dev-http-report.json`, `visual-review.json` and
`verification-report.json`. Retained 3.2D–G conversion reports were read, not
modified or regenerated.

```powershell
npm exec vitest run -- src/config/ocr-benchmark.test.ts src/app/benchmarks/ocr-results.test.ts src/config/conversion-benchmark.test.ts src/lib/seo/json-ld.test.ts src/lib/seo/sitemap-dates.test.ts src/app/sitemap.test.ts src/lib/seo/routes.test.ts
npm run build
# Start the built app on a loopback-only port using an offline test configuration.
$env:BENCHMARK_BASE_URL = 'http://127.0.0.1:3002'
node scripts/phase3-ocr-publication-check.mjs
```

The HTTP verifier only accepts loopback HTTP and does not upload or convert
files. Run its strict raw-path gate against the built application, since Next.js
development diagnostics can include machine paths. The local build used
placeholder public configuration and blank cloud credentials; `.env.local`
was not edited.

## Next phase gate

The subsequent bounded task **3.3: an English scanned-PDF guide** was completed
locally on 7 October 2026. It uses these measured results to explain when to
use searchable PDF versus editable Word, what clean ruled tables preserve and
which layouts still need review. See
[the guide phase record](PHASE_3_3_SCANNED_PDF_GUIDE.md).
Real-customer evidence, public HTTPS/load/retention/cost measurements and public
launch remain separate open gates.
