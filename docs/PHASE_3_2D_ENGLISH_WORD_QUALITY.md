# Phase 3.2D: English OCR to editable Word

**Date:** 3 October 2026

**Status:** Scoped English task complete locally. Production launch remains deferred.

**Scope:** English document conversion quality in the existing local preview.
The website stays English-only. Hindi pages and Hindi-specific improvements
are outside this task. No paid API or public deployment is required.

## Problem and acceptance criteria

The previous clean English OCR result preserved recognized words and amounts,
but placed a small page image next to 9.5-point text in a two-column table.
This duplicated the page and made the editable result needlessly cramped.
Multiple original paragraphs also became one paragraph with manual line breaks.

The new, unchanged four-case corpus initially passed **1/4**. The scanned memo
lost the space in `has a`; the invoice lost all three item rows; and the
two-page scan put its landscape second page onto a portrait Word page.
The selectable memo was already passing. These baseline failures and the final
results are saved separately in `quality/phase3-english-word/`.

The bounded improvement targets readable, full-width editable OCR text with
word spaces, repeated content and source-page order preserved. Page dimensions
and explicit page boundaries must survive in the controlled multi-page case.
Native table reconstruction and exact visual fidelity are separate claims;
the invoice check measures the association between a row's labels and values.

The corpus includes an English memo as both selectable and scanned input, a
scanned invoice and a two-page scanned report. Originals come from literal
DOCX content rendered independently by LibreOffice. Raster fixtures must have
zero selectable source text. Expected answers are never uploaded to the app.

## Implementation

When the initial OCR text contains Latin letters and the primary converter
does not produce enough editable content, the fallback reads Tesseract's actual
PSM 3 TXT output. This avoids word spaces and table rows being lost when text is
extracted from the recognizer's hidden PDF glyph layer. It keeps repeated lines;
it does not merge segmentation outputs, deduplicate rows or repair expected words.
The script check is not a language detector; only English is tested here.

The fallback writes full-width 11-point editable OCR lines with the original
input's page sizes, orientation and explicit page boundaries. It does not use
the generated OCR intermediate to determine physical dimensions. Native table
cells, original typography, photos and diagrams are not preserved by this
text-only fallback. Successful primary pdf2docx output keeps its existing path;
its broader layout fidelity is not established by this change.

Sparse or empty hidden text on an English page gets a raw-TXT recovery attempt
before the unchanged content gates are applied. Truly unreadable content returns
422, missing executable/model diagnostics remain 503, and unexpected runtime
failure remains 500. A readable first page cannot hide an unreadable later page
on the new fallback path. No OCR DPI, model, page limit or global quality
threshold was raised. The extra TXT pass runs only on the eligible recovery path,
so it adds OCR work there; this is a content-quality improvement, not a speed claim.

The Python helpers ship with the existing Docker `COPY scripts` setup. Local OCR
binaries, preview build output and temporary test files are now excluded from
Docker build contexts. No deployment was performed.

## Verification contract

The new validator preserves word boundaries: it collapses existing whitespace
instead of removing all spaces. It checks complete phrases, occurrences,
reading order, numeric values, visible editable text, DOCX integrity and
independently rendered output. Required expectations are fixed before running
the conversions. Source/output PNGs are reviewed separately from text checks.

Run the local application with `npm run dev:local-preview`, then:

```powershell
npm run phase3.2d:layout-tests
npm run phase3.2d:validator-tests
npm run phase3.2d:english-word
python scripts/phase3-english-word-rejection.py
npm run phase2.3e:last-page
```

Sources, DOCX outputs and rendered previews are under ignored
`tmp/pdfs/phase3.2d-english-word/`. Committed diagnostic evidence belongs in
`quality/phase3-english-word/`.

## Verified result

| Actual local HTTP conversion | Before | After | Final observed time |
| --- | --- | --- | --- |
| Selectable English memo | Pass | Pass | 2.02 s |
| Scanned English memo | Fail: word space and wrapper | Pass | 3.72 s |
| Scanned three-row invoice | Fail: missing rows and wrapper | Pass | 3.63 s |
| Portrait + landscape scan | Fail: wrapper and page geometry | Pass | 6.36 s |

All four returned valid, editable DOCX files and passed exact normalized content,
word-boundary, amount, reading-order, independent render, page-count and page-size
checks. The invoice retains its complete row text and values, but is **not a
native Word table**. The two-page result retains 612 x 792 and 792 x 612 point
sections. Rendered scans were visually inspected: readable full-width text, all
invoice rows visible, no duplicate thumbnail column and no clipped final page.

These timings are individual local observations and exclude the independent
rendering checks. They are not latency percentiles or production benchmarks.

- English layout/branch/runtime contracts: **20/20**.
- Strict corpus validator tests: **24/24**.
- HTTP output quality: **4/4**, plus **2/2** unreadable-input rejections with no
  successful artifact (unreadable alone; English readable page plus unreadable page).
- Existing last-page regression: single conversion, in-process chunk,
  subprocess chunk and OCR conversion branch pass. That last regression uses
  a searchable-input stub and is not extra live OCR evidence.
- Independent review found two content-gate ordering/classification issues;
  both were fixed, covered by regressions and re-reviewed before the final HTTP run.

Evidence: `baseline-report.json`, `latest-report.json`, `rejection-report.json`
and the fixture/validator contract in `quality/phase3-english-word/README.md`.
The new CI workflow runs Python contracts only; local HTTP/render evidence is
separate. No claim of a fresh whole-project build or full test-suite run is made
for this Python-only conversion task. Browser automation was policy-blocked, so
this task's runtime proof uses the actual local conversion API and opened/rendered
output files rather than a fresh browser-click recording.

## Boundaries

These controlled English samples do not prove arbitrary OCR accuracy,
handwriting recognition, complex table reconstruction, exact source design,
production load, public availability or production costs. The normal
selectable-text path and existing non-Latin fallback are preserved by scope.
Real-customer evidence and the deferred public launch gates remain open.

Next bounded English task: verify and correct the separate **OCR-to-searchable-PDF
physical page size** path. During this work, the existing clean English OCR PDF
artifact measured 1402.5 x 1815 points versus its 612 x 792 point input. That
separate output path was not edited in this task; the Word fallback now uses its
original input geometry. Complex English table/graphic reconstruction remains a
later quality gate. Hindi pages and Hindi-specific work remain on hold.
