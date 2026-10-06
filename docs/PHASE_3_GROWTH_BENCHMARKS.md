# Phase 3.1: evidence-based benchmark publishing

**Started:** 3 October 2026  
**Status:** Tasks 3.1, 3.2A, scoped 3.2B, local OCR 3.2C, English Word 3.2D, OCR geometry 3.2E, English Word tables 3.2F and two-table pages 3.2G complete locally

Phase 2 remains 90% complete. Its public HTTPS/load/retention/cost gate is deferred under the user's no-paid-plan decision, and its real-customer evidence cannot be manufactured locally. Those external launch gates remain open and are not counted as complete. This explicit deferral allows no-cost Phase 3 preparation to continue without misrepresenting Phase 2 as finished.

## Task 3.1 scope

The first Phase 3 roadmap item is to publish benchmark reports and unique educational content. The initial `/benchmarks` report uses the 3 October local release revalidation and:

- reports PDF-to-Word, PDF-to-Excel, and PDF-to-PowerPoint artifact results;
- states the fixture, environment, output bytes, editable-text check, and page-completeness result;
- separates controlled local evidence from production latency, capacity, uptime, cost, and universal-accuracy claims;
- adds Dataset, Breadcrumb, and FAQ structured data;
- adds sitemap, footer and `llms.txt` discovery (the initial Hindi variant was
  retired by the English-only decision in Task 3.2B).

## Exit checks

- Benchmark data contract, SEO route, and sitemap tests passed: 4/4.
- TypeScript and touched-file ESLint passed with zero errors.
- Next.js 16.3.6 production build passed and generated 169/169 pages, including `/benchmarks`.
- At Task 3.1 completion the sitemap contained both `/benchmarks` and
  `/hi/benchmarks`; Task 3.2B retains only the English URL and redirects the old
  Hindi URL. `llms.txt` contains the report link.
- Browser review at a 514-pixel viewport found no horizontal overflow, all three result cards, valid Dataset/Breadcrumb/FAQ JSON-LD, and zero console warnings or errors.

The report is ready in the local application. Publishing it on the public Internet remains part of the deferred production deployment decision.

## Task 3.2A: expanded language and document evidence

The diagnostic completed locally: six synthetic PDFs across
eighteen HTTP Office conversions, with 14 checks passing and four failing.
The expanded results appear on `/benchmarks#document-corpus`; see
[the detailed findings and follow-up gate](PHASE_3_2_MULTILINGUAL_CORPUS.md).
This baseline did not close conversion quality or Phase 2 production gates.

## Task 3.2B: English website and targeted conversion fixes

The website now exposes English only; old Hindi page URLs redirect to their
English equivalents. Hindi document input remains supported and tested.
Spreadsheet amount/identifier typing and Hindi Office text/shaping regressions
were fixed. The unchanged expanded corpus passes **18/18**, with the existing
Excel 7/7 and rendered PowerPoint 8/8 corpora still passing. The full automated
suite passes 722/722 and the production build succeeds. See
[implementation and validation evidence](PHASE_3_2B_ENGLISH_SITE_AND_CONVERSION_FIXES.md).

## Task 3.2C: actual local OCR and failure handling

The project-local English/Hindi Tesseract runtime now supports the no-cost
preview. The new corpus verifies image-only inputs, selected Hindi conjuncts,
searchable PDF and editable Word outputs, existing-text preservation, and
unreadable-scan rejection. Eight HTTP checks pass. Missing OCR infrastructure
returns 503; confirmed unreadable input returns 422 instead of a false success.
Small compressed scans now use explicit per-page text evidence for routing.

The selectable Office corpus also passes 18/18 after explicitly pinning the
local preview to its verified Python engine. Windows Word COM corrupted glyphs
in an intermediate run; its underlying engine was not repaired or validated.
See [runtime, validation evidence and limits](PHASE_3_2C_LOCAL_OCR_VERIFICATION.md).

## Task 3.2D: readable English OCR to Word

Complete locally: the unchanged four-case English corpus improved from **1/4 to
4/4**. Raw recognizer text now preserves the memo's word space and the invoice's
three rows; the fallback writes readable full-width text with original portrait
and landscape dimensions. All four outputs render with complete content and the
controlled page counts. The two unreadable-input HTTP checks, 44 focused Python
tests and existing last-page regression pass. See
[the implementation, results and boundaries](PHASE_3_2D_ENGLISH_WORD_QUALITY.md).
The fallback is text-only: native table cells, graphics and exact source design
remain separate quality work.

## Task 3.2E: searchable PDF size and scanned appearance

Complete locally: the unchanged English OCR geometry corpus improved from **1/5
to 5/5**. Correct DPI metadata and exact text-layer placement preserve physical
dimensions. Copying image-only source pages retains their original sharpness,
crop boxes and rotation. All seven output pages have exact visible pixel matches
under independent Poppler rendering; full text, word bounds and page order pass.
The two unreadable-input checks and 32 focused tests also pass. See
[the fix, evidence and limits](PHASE_3_2E_OCR_PDF_GEOMETRY.md).

## Task 3.2F: native editable tables from English scanned invoices

Complete locally: the unchanged four-case corpus improved from **1/4 to 4/4**.
Complete ruled grids now become native editable Word cells in the Latin OCR
fallback. Wrapped descriptions, leading-zero identifiers, quantities and amounts
remain correctly associated. A two-page portrait/landscape case keeps both tables;
borderless prose stays as paragraphs. All five output pages pass independent
render and visual checks. The 97 focused automated tests, four existing English
HTTP conversions and two unreadable-input checks pass. See
[the implementation, evidence and boundaries](PHASE_3_2F_ENGLISH_WORD_TABLES.md).

## Task 3.2G: two separate native tables on one scanned page

Complete locally: the frozen four-case corpus improved from **1/4 to 4/4**.
Two complete vertically separated grids become separate editable Word tables;
full prose before, between and after them retains its order. The portrait,
wrapped-description and landscape cases pass exact table matrices, identifiers,
amounts and independently rendered page checks. The borderless control invents
no tables. All four final pages pass visual review; source typography and exact
spacing are not claimed. The 139 focused tests, eight existing HTTP conversions,
two unreadable-input rejections and last-page regression pass. See
[the implementation, evidence and limits](PHASE_3_2G_ENGLISH_MULTITABLE_WORD.md).

**Next bounded English task (3.2H):** add the verified 3.2D–G OCR results to the
local English `/benchmarks` page, preserving the historical baseline and stating
each report's dates, controlled fixture counts and unsupported-layout limits.
Include data-contract, structured-data, responsive and build checks. This is
evidence presentation, with no conversion-engine change or public deployment.
Hindi pages and Hindi-specific improvements remain on hold.
Real-customer feedback and deferred production launch gates remain open. Selected
fixture passes do not establish universal accuracy or production capacity.
No paid deployment was made for these tasks.
