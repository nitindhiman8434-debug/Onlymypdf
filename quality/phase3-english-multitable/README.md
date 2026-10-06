# Phase 3.2G: two English tables on one page

This local gate freezes four synthetic English scans before conversion. Each
positive source has two separate clean ruled tables stacked on one page, with
complete prose before, between and after them. Every table has four columns and
a header plus three body rows. The negative memo has two borderless note groups
and must retain zero native Word tables.

| Case | Page and required structure |
| --- | --- |
| `english-two-tables-portrait-scan` | Two distinct titled invoices on one portrait page |
| `english-two-tables-wrapped-scan` | A wrapped description in each separate table on one portrait page |
| `english-two-tables-landscape-scan` | Two separate invoices on one landscape page |
| `english-two-groups-borderless-scan` | Two ordered groups of aligned prose, with no invented tables |

Leading-zero IDs and decimal amounts are literal. Both tables repeat their
headers and the description `Review service`, while IDs and amounts distinguish
the rows. Repeated words cannot be dropped, duplicated or moved between tables.

## Verified local results — 7 October 2026

The frozen baseline passed 1/4, the intermediate run passed 2/4, and the final
HTTP run passed **4/4** without changing the source definitions or expectations.
The existing single-table and English Word HTTP corpora each passed 4/4 again.
All **139 focused automated tests** passed. Independent rendered and raw XML
review passed all four final pages; styling differences are explicitly recorded.
Both unreadable-input checks returned HTTP 422 without a false output file.

See `sources-report.json`, `source-visual-review.json`, `baseline-report.json`,
`after-report.json`, `final-report.json`, `single-table-regression-report.json`,
`word-regression-report.json`, `rejection-report.json`, `unit-report.json` and
`visual-review.json`.
The source and output PDF/DOCX/PNG artifacts are local ignored test files;
the JSON reports retain their paths and hashes. These results establish this
bounded synthetic local gate, not arbitrary-file accuracy or public readiness.

## Prepare sources without HTTP

```powershell
python -m unittest discover -s scripts -p test_phase3_english_multitable_corpus.py
python scripts/phase3-english-multitable-corpus.py --generate-only --run-label sources --report tmp/pdfs/phase3.2g-english-multitable/sources-report.json
```

Requirements are the existing local Python/PyMuPDF/python-docx/Pillow,
LibreOffice and application OCR runtime. Nothing is downloaded or installed.
The runner imports the established 3.2F validator, source writer, converter and
the 3.2D render/loopback helpers without changing previous files or reports.
Its isolated imported helper instance adds stronger source grid-separation
validation before the shared generator rasterizes an upload.

Literal source DOCX text and complete native matrices must pass first.
LibreOffice renders each original; exact per-page text, one-page completeness,
page dimensions, visible ruling and required wrapped descriptions must pass.
Additional PDF geometry verifies exactly two distinct 4-by-4 grids and checks
that the full intervening paragraph lies in their gap. The control must have
zero ruled grids. Only then is the source rasterized at 300 DPI into a PDF with
one image and zero selectable characters per page. Source PNGs need visual QA.

## Separate immutable baseline and final runs

Run conversion only against the authorized local application:

```powershell
python scripts/phase3-english-multitable-corpus.py --run-label baseline --reuse-sources tmp/pdfs/phase3.2g-english-multitable/sources-report.json --base-url http://127.0.0.1:3001
python scripts/phase3-english-multitable-corpus.py --run-label final --reuse-sources tmp/pdfs/phase3.2g-english-multitable/sources-report.json --base-url http://127.0.0.1:3001
```

`--reuse-sources` checks the frozen literal definition and all imported
validator/helper hashes, then verifies the source DOCX, source PDF and upload
PDF hashes. It never regenerates a fixture. A pre-existing run directory or
report is refused. Default reports are stored separately as
`quality/phase3-english-multitable/<run-label>-report.json`; original/output
artifacts stay in `tmp/pdfs/phase3.2g-english-multitable/<run-label>/`.

`--case`, `--report`, `--libreoffice` and bounded `--timeout` are available.
Generate-only mode performs no HTTP and records `allPassed: null`.

## Required output evidence

- HTTP 200 with DOCX MIME, valid ZIP/XML and visible editable body text.
- Exact complete native table matrices in order: two tables, each four columns
  and four rows, with unchanged cell values. One combined table, one missing
  table, a text-only transcript or swapped rows/cells fails.
- All headings and prose exactly once, with the separating paragraph between
  the correct tables. Exact numeric values retain leading zeros and decimals.
- No embedded page screenshot, extra document columns or unexpected table in
  the borderless control.
- Independent LibreOffice output rendering with complete per-page text,
  unchanged page dimensions and no extra page. Source and output PNGs are kept
  for visual checks of table separation, wrapping, clipping and final text.

Normalization only collapses existing whitespace and applies NFC. It does not
delete word spaces or relax punctuation, IDs, amounts or table topology.
Offline tests reject swapped tables, moved/duplicated middle prose, merged
tables, repeated-header loss, amount swaps between repeated service names,
paragraph-only output, a missing final paragraph and overflow to another page.

The scope remains two clean vertically stacked full ruled tables. Side-by-side
tables, merged cells, broken ruling, skew, arbitrary borderless invoices and
other-language quality are not established. Exact typography and source pixel
positions are not required. No previous corpus is regenerated, and no paid
service, cloud request or deployment is performed by this runner.
