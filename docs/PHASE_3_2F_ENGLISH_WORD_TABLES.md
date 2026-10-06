# Phase 3.2F: English scanned invoices to editable Word tables

**Date:** 7 October 2026

**Status:** Scoped task complete locally; public launch remains deferred.

## Problem and scope

The previous Latin OCR fallback retained recognized text as full-width paragraphs.
It did not reconstruct native Word cells. In the fixed new corpus, the three
invoice cases failed and the plain memo passed. Wrapped descriptions appeared
after quantities/amounts, and OCR mistook vertical rules for extra header text.
An initial geometry-only implementation still passed just 1/4: native cells
cannot safely be assembled from incorrect or ambiguous word boxes.

This task handles one complete rectangular ruled grid per page in the existing
Latin-script fallback, after the primary converter fails its existing gate.
Successful primary output and the existing non-Latin fallback are unchanged.
No Hindi pages, cloud settings, paid services or public deployment are involved.

## Implementation

The existing fallback OCR pass emits TXT and TSV together. Complete grid borders
and word positions establish cell membership. Literal identifiers, amounts and
repeated words are retained; the converter never calculates totals, corrects
expected strings or consults test definitions. Wrapped cell text is ordered by
word geometry. A token-conservation check requires all recognized tokens,
including repeats, to appear exactly once in the reconstructed output.

Border preprocessing is limited to verified vertical rules on one complete grid.
Horizontal rules remain to help recognition retain row order. The original page
image supplies table geometry and is never modified. Uncertain geometry or text
touching a removal region prevents preprocessing. This uses the existing fallback
recognition pass, not a new OCR invocation per cell.

The writer creates editable Word table cells with source-relative column widths,
keeps original portrait/landscape page dimensions and preserves raw surrounding
paragraph spacing where the TXT/TSV boundary agrees. Missing or malformed optional
TSV falls back to recognized paragraphs. An unreadable page still fails instead
of returning a successful partial document.

## Verification

The unchanged four-case corpus improved from **1/4 to 4/4**. Final HTTP results:

| Case | Native tables | Pages | Result |
| --- | --- | --- | --- |
| Ruled invoice with leading-zero IDs | 1 | 1 | Exact header and three item rows |
| Invoice with wrapped descriptions | 1 | 1 | Each full description stays with its quantity and amount |
| Portrait then landscape invoices | 2 | 2 | Exact cell matrices, page order, final paragraph and dimensions |
| Borderless reference memo | 0 | 1 | Complete ordered prose, no invented table |

All returned files have correct DOCX MIME, valid ZIP/XML, complete editable text
and exact expected numeric strings. Independent LibreOffice renders pass complete
per-page text, page count and dimensions. All five output PNG pages were visually
inspected. After the final guard fix, all five newly rendered PNGs match those
reviewed images pixel for pixel. Headings/header styling, row spacing, margins
and line-wrap positions differ from the source; exact design is not claimed.

Final code review found and fixed a preprocessing edge case: thin punctuation
beside a vertical rule could be mistaken for removable antialiasing. Source-ink
checks now reject unexplained short fringe marks and local rule widening,
including faint gray strokes. Independent review verified rejection across 63
length/shade combinations. Token conservation alone could not catch this issue
because it happened before recognition. No remaining targeted-review blocker.

- **97 automated Python tests pass:** 29 grid/preprocessing contracts, 4 writer
  integration contracts, 21 existing English OCR contracts, 19 new strict corpus
  validator tests and 24 existing English corpus validator tests.
- **4/4 existing English HTTP conversions pass**, including selectable text,
  scanned memo, the earlier invoice and a two-page document.
- **2/2 unreadable-input HTTP checks pass:** correct 422 response without a
  document, including an unreadable final page after a readable first page.
- Existing single/chunked/OCR-branch last-page regression passes. Its recognizer
  is substituted with searchable input; it is not live OCR evidence.

The final corpus took 3.5–13.5 seconds per local request in this run. These are
individual observations, not speed improvements or production latency percentiles.
No fresh full-project build, unrelated full test suite or browser-click verification
is claimed for these Python changes. GitHub CI runs the automated contracts;
the local HTTP and independently rendered artifacts are separate evidence.

The baseline and intermediate reports remain separate in
`quality/phase3-english-table/`; every new corpus run reuses hash-checked source bytes.
Authoritative final evidence: `final-strict-report.json`, `unit-report.json`,
`word-regression-strict-report.json`, `rejection-strict-report.json`, and
`visual-review-final-strict.json` (linked to the original `visual-review.json`).
Literal fixture definitions and strict validators are fixed before the baseline.
Source scans were rendered from independently validated DOCX/PDF documents and
contain zero selectable characters. Generated DOCX/PDF/PNG artifacts are under
ignored `tmp/pdfs/phase3.2f-english-table/`.

## Reproduce

Start the existing no-cost local preview with `npm run dev:local-preview`:

```powershell
npm run phase3.2f:table-tests
npm run phase3.2f:validator-tests
npm run phase3.2d:layout-tests
npm run phase3.2d:validator-tests
python scripts/phase3-english-table-corpus.py --generate-only --run-label fresh-sources
python scripts/phase3-english-table-corpus.py --run-label recheck --reuse-sources quality/phase3-english-table/fresh-sources-report.json
```

Use fresh labels; the runner refuses to overwrite reports or artifacts. It only
accepts loopback HTTP targets. Automated DOCX checks require exact complete cell
matrices and numeric strings, valid ZIP/XML and no embedded scan pictures.
LibreOffice separately renders results to check complete page text, page count
and dimensions. Inspect every PNG for wrapping, clipping and row association.

## Boundaries and next task

The detector supports 2–8 columns and 2–40 rows on one fully ruled rectangular
grid per page. Controlled HTTP evidence covers four-column invoice tables,
including wrapped descriptions and a portrait/landscape two-page document.
Borderless prose must remain paragraphs. Merged, nested, partial, skewed or
multiple grids are conservatively unsupported; this is not universal OCR accuracy,
exact source typography, PDF accessibility or a production capacity guarantee.

**Next bounded task:** two separate clean ruled tables on one English page,
preserving the paragraphs before, between and after them. Real-customer evidence
and deferred public HTTPS/load/retention/cost gates remain open.
