# Phase 3.2D: English PDF-to-Word quality

This local diagnostic tests complete readable English text and controlled Word
layout. It contains no other language fixtures and does not run or modify the
previous multilingual corpus. Only its loopback HTTP transport is reused.

## Run

Requirements: the existing local application, Python with PyMuPDF/python-docx/
Pillow, LibreOffice and a local Arial, Noto Sans or DejaVu Sans font. OCR scans
need the application's configured English-capable OCR runtime. The runner does
not install dependencies, download fonts/models, change the application
environment or call paid services.

```powershell
python -m unittest discover -s scripts -p test_phase3_english_word_corpus.py
python scripts/phase3-english-word-corpus.py --generate-only --report tmp/pdfs/phase3.2d-english-word/generation-report.json
python scripts/phase3-english-word-corpus.py --base-url http://127.0.0.1:3001
python scripts/phase3-english-word-rejection.py --base-url http://127.0.0.1:3001
```

`--case` can be repeated to select a focused subset. `--report` writes a separate
baseline or recheck without replacing the latest report. `--libreoffice` accepts
an existing executable, and `--timeout` allows 1–600 seconds per conversion.
Each successful HTTP artifact is rendered once in a separate LibreOffice profile;
its render has an additional 90-second timeout. The conversion duration and total
duration including verification are reported separately.

Generate-only mode performs no HTTP calls and reports `allPassed: null`. Its
success establishes source integrity, not conversion quality. Source DOCX/PDF,
image-only uploads, converted DOCX and output render previews remain in ignored
`tmp/pdfs/phase3.2d-english-word/`. The tracked report contains synthetic evidence.

## Four controlled cases

| Case | Input | Contract |
| --- | --- | --- |
| English memo selectable | One selectable page | Full phrases, word spaces, paragraph order, leading-zero identifier and amount |
| English memo scan | Same memo as a 300 DPI image-only PDF | Same content contract through actual OCR |
| English invoice scan | One page with three item rows | Complete descriptions, quantities, prices, total and row association |
| English two-page scan | Portrait first page, landscape second page | All page text once, correct order, final paragraph, page count and dimensions |

Literal English blocks are written to DOCX and independently rendered through
LibreOffice. Source DOCX text and every source PDF page must match the literal
fixture. Page dimensions must match within one point. Scan variants are then
rasterized at 300 DPI and must have zero selectable characters on every upload
page. Expected text is never sent separately with a conversion request.

## What must pass

- HTTP 200, DOCX MIME, ZIP CRC, required document XML and visible editable body
  text. Metadata, image descriptions, directly hidden runs and deleted text
  cannot supply expected words.
- Full normalized text equality, exact block occurrence counts and ordered
  content blocks. NFC and whitespace collapse preserve existing word spaces;
  `Keep spaces` cannot pass as `Keepspaces`. Complete phrase boundaries prevent
  `paid` from matching inside `unpaid`.
- Exact numeric values with boundaries: leading zeros and decimals survive,
  while extra digits or signs fail. A sentence-final period is permitted.
- Each invoice row's description and numeric values remain associated and in
  order. Native DOCX table-cell reconstruction is recorded separately; a correct
  plain-text transcript does not claim an editable table.
- No unexpected embedded page pictures, image-plus-transcript side-by-side
  wrapper or multiple text columns. These controlled sources contain no photos
  and expect a full-width editable document.
- Independent LibreOffice output rendering succeeds. Every page retains its
  expected complete normalized text, page count and dimensions within one point.
  This catches missing last pages, overflow pages, wrong orientation, duplicated
  visual/transcript pages and inflated physical page sizes.

The report separates editable-content, layout and rendered-page checks. It keeps
actual extracted text, failed blocks, numeric counts, row matches, image geometry,
font sizes, source/output hashes and preview paths. Source and output previews
still require visual review; text extraction alone cannot establish every visual
detail. The runner exits nonzero for a source, HTTP, artifact or quality failure.

## Recorded result

The unchanged positive corpus improved from **1/4** in `baseline-report.json`
to **4/4** in `latest-report.json`. The separate rejection command generates a
shape-only unreadable scan and appends it to the existing English memo scan.
`rejection-report.json` confirms both requests return422 with the specific
unreadable-content message and no Word artifact. It uses no multilingual fixtures.

The new text-only fallback preserves all three invoice row texts but does not
reconstruct native Word cells. Source graphics are not represented by that
fallback. See `docs/PHASE_3_2D_ENGLISH_WORD_QUALITY.md` for implementation limits,
local validation and the separate remaining OCR-PDF geometry issue.

## Limits

These documents deliberately fit comfortably on their intended pages, so strict
pagination is appropriate for this gate. It is not a promise that all real-world
Word documents preserve PDF pagination. Exact fonts, pixel positions, paragraph
styles, native invoice-table reconstruction, arbitrary layout fidelity and PDF
accessibility semantics are not guaranteed by a passing report.

Only English synthetic content is tested. Difficult scan degradation, handwriting,
mixed scanned/selectable pages, private customer files, production capacity and
external deployment are separate tasks. The runner does not infer the server's
OCR model configuration from the runner's own environment.
