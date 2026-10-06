# Phase 3.2F: English scans to native editable Word tables

This bounded local gate contains four synthetic English cases. Three cases
require exact native Word table cells; a memo control requires zero tables.
It generates no other-language fixtures and uses no paid services or deployment.

Verified locally on 7 October 2026: baseline **1/4**, final **4/4**. The final
guarded implementation is recorded in `final-strict-report.json`; older runs are
retained as diagnostic evidence. `unit-report.json` records 97 passing tests.
Existing English Word regression is 4/4 and unreadable-input rejection is 2/2
(`word-regression-strict-report.json`, `rejection-strict-report.json`). All five
rendered output pages passed visual QA; `visual-review-final-strict.json` proves
the final images exactly match the reviewed images. See the full phase report in
`docs/PHASE_3_2F_ENGLISH_WORD_TABLES.md` for limits and the next task.

| Case | Required result |
| --- | --- |
| `english-ruled-invoice-scan` | One explicit black ruled invoice, four columns, header plus three item rows |
| `english-wrapped-invoice-scan` | Same topology with two descriptions wrapping within their own cells |
| `english-two-invoice-scan` | Two distinct invoices, portrait first page and landscape second page |
| `english-borderless-memo-scan` | Aligned reference/amount prose retained as ordered paragraphs, no invented table |

Every invoice includes leading-zero identifiers, decimal amounts, surrounding
paragraphs and a final paragraph. The expected matrices are literal definitions
fixed before conversion. NFC and existing whitespace are normalized; words,
punctuation, digits, cell boundaries and row/column order are not relaxed.

## Generate and validate sources first

Use the existing local Python, PyMuPDF, python-docx, Pillow, LibreOffice and
English OCR installation. No runtime is installed by the runner.

```powershell
python -m unittest discover -s scripts -p test_phase3_english_table_corpus.py
python scripts/phase3-english-table-corpus.py --generate-only --run-label sources
```

The runner writes literal DOCX files and checks their complete content and exact
native matrices. LibreOffice independently renders each source; its text, page
count, dimensions and visible black grid lines must pass before a 300 DPI
image-only PDF is created. The wrapped case additionally proves that its source
descriptions occupy multiple rendered lines. Every upload page must contain
exactly one image and zero selectable characters.

Inspect all source PNGs before scoring conversion. Generate-only success proves
source integrity, not conversion quality.

## Keep baseline and final evidence separate

Run these only against the authorized local application. `--reuse-sources`
preserves the exact source bytes from the generate-only report and verifies the
input PDF, original DOCX and original PDF hashes before sending each scan.

```powershell
python scripts/phase3-english-table-corpus.py --run-label baseline --reuse-sources quality/phase3-english-table/sources-report.json --base-url http://127.0.0.1:3001
python scripts/phase3-english-table-corpus.py --run-label final --reuse-sources quality/phase3-english-table/sources-report.json --base-url http://127.0.0.1:3001
```

An existing run directory or report is refused. Use a fresh label for another
run. Reports default to `quality/phase3-english-table/<label>-report.json` and
artifacts to ignored `tmp/pdfs/phase3.2f-english-table/<label>/`. Baseline and
final output DOCX, rendered PDF and PNG files therefore remain separate.
`--report`, `--case`, `--libreoffice` and `--timeout` are available; timeout is
bounded to 1–600 seconds per HTTP conversion. LibreOffice has a separate
90-second render timeout. Both conversion and total verification times are
reported. The shared transport rejects non-loopback endpoints.

## Strict acceptance contract

- HTTP 200, correct DOCX MIME, valid ZIP CRC and required XML.
- Complete visible editable text exactly once and in source order, including
  every header, surrounding paragraph, leading-zero ID, decimal and final line.
- Exact whole native table matrices, count, row count and column count. A
  paragraph transcript, swapped cells, missing header, duplicate table, merged
  cells or additional empty table fails. A text-only memo cannot gain a table.
- No embedded page pictures, image/text wrapper or unexpected document columns.
- Independent LibreOffice output rendering with exact per-page text, page
  count and dimensions within one point. The second page keeps its orientation.
- Separate manual inspection of every source/output PNG for clear cell
  association, borders, wrapping, clipping and page completeness. Reports mark
  visual QA as required rather than inventing an automatic visual pass.

Offline tests include changed amounts, swapped amounts with the same numeric
inventory, leading-zero loss, paragraph-only invoices, duplicate transcripts,
wrong cell boundaries, hidden text, missing final pages and wrong orientation.

This is deliberately limited to complete rectangular ruled grids with four
unmerged columns. Passing these cases does not establish support for arbitrary
borderless invoices, merged cells, nested tables, complex page layouts or other
languages. Source/output fonts and pixel-perfect positioning are not guaranteed.
