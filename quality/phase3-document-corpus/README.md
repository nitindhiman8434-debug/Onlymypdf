# Phase 3.2A local document corpus

This diagnostic creates six entirely synthetic, selectable-text PDF fixtures from
local fonts and exercises the actual local Word, Excel and PowerPoint HTTP routes.
It does not change any conversion pipeline. It is a content-preservation diagnostic,
not a universal accuracy score, visual comparison, OCR benchmark or production test.

## Run

Python dependencies: PyMuPDF with `Page.insert_htmlbox`, Pillow and fontTools
(for extracting the regular Nirmala face from its local font collection). The fixture
generator uses existing Windows Arial/Nirmala fonts or Linux Noto/DejaVu fonts;
it never downloads fonts or contacts external services.

```powershell
python -m unittest discover -s scripts -p test_phase3_document_corpus.py
python scripts/phase3-document-corpus.py --generate-only --report tmp/pdfs/phase3.2/generation-report.json
python scripts/phase3-document-corpus.py
```

Start the local preview on `http://127.0.0.1:3001` before the final command. Routes
run sequentially with a 180-second deadline each. For a focused recheck:

```powershell
python scripts/phase3-document-corpus.py --case hindi-memo --tool pdf-to-word --report tmp/pdfs/phase3.2/hindi-recheck.json
```

`--case` and `--tool` can be repeated. `--timeout` accepts 1–600 seconds per route.
Only literal loopback IPs and `localhost` origins are allowed. Environment HTTP
proxies are disabled and redirects to other origins are refused. Exit code 1
means a source validation, conversion or quality check failed. The JSON report is
still written. Generate-only mode performs no HTTP calls and must not be presented
as conversion success (`summary.allPassed` is `null` in that mode).

## Coverage and evidence

- Hindi memo: Devanagari words, identifiers and amounts.
- Hindi/English invoice: bilingual descriptions and decimal totals.
- French invoice: accents, French numeric separators and a formula-like literal.
- German invoice: umlauts, leading-zero identifiers, negative numbers and locale decimals.
- Mixed orientation: portrait/landscape pages and repeated first/middle/last markers.
- Dense two-column article: paragraph markers and repeated phrases on both pages.

Every source is extracted again after saving. A missing or duplicated expected
source marker invalidates the fixture and skips conversion scoring. Unicode NFC
normalization and whitespace removal accommodate line wrapping and shaped-text
extraction; script characters, accents, leading zeros and decimal punctuation are
never discarded. Counts compare every expected occurrence, including repeated
phrases, so unique-token recall cannot hide duplication or missing pages.

Output checks require ZIP CRC and the relevant Office XML parts. Word checks
editable document text. Excel checks literal cells and rejects any generated
formula: these sources contain no intended spreadsheet formulas. PowerPoint
checks editable on-slide XML text and reports notes separately; notes do not
satisfy an on-slide marker. These checks do not establish rendering fidelity or
the application's ability to open the files in Microsoft Office.

Numeric markers require lexical preservation of the raw Office XML cell values.
For example, an Excel value `1234.56` with a number format that displays
`1.234,56` will fail a German literal marker even if its displayed value is
equivalent. This strict content diagnostic does not label that numerical
equivalence as data corruption. Returned MIME types are checked independently;
a valid ZIP with the wrong MIME type does not pass. HTTP-200 malformed Office
files are reported as failed artifacts; HTTP/transport failures are errors.

Excel primary worksheets and the explicitly labeled `Source text` recovery sheet
are evaluated separately. The recovery schema is validated and only its source
text column is counted; page numbers, descriptions and headers are excluded.
Marker coverage uses `max(primary occurrences, recovery occurrences)`, allowing
the same source text once in each representation. Excess occurrences inside
either group still fail. Separate `primaryMarkerCheck` and `recoveryMarkerCheck`
results prevent backup text from being presented as correctly mapped table cells.

Two targeted typed-cell checks independently validate primary table rows: the
French `Crème brûlée` amount must be numeric `12.5`, and the German
`Artikelkennung` must be the string `001234`. A correct source backup cannot
satisfy these checks. They validate only those selected cells, not every number
or the correctness of the whole spreadsheet.

`latest-report.json` is the local measurement source. Raw PDFs, Office files,
per-page previews and `contact-sheet.png` stay under ignored
`tmp/pdfs/phase3.2/`. Each route result contains its exact status, duration, byte
count, SHA-256, missing/duplicated markers and structural validation. No customer
documents or private data are involved. Source previews require human inspection;
the runner does not infer visual correctness from text extraction.

Image-only scans and actual OCR recognition are excluded. Other missing language
families, real customer evidence, browser UX, reading order, output rendering,
cloud latency/load and production cost require separate work.

The Hindi source deliberately uses simple words without complex conjuncts. The
local PyMuPDF generator produced unreliable selectable Unicode for some complex
glyphs; the source gate caught this before conversion testing. Complex conjunct
coverage remains open. Identifier markers use underscores because this generator
maps Arial ASCII hyphens to soft hyphens in its source extraction. No comparison
rule strips these characters to manufacture a passing source or output score.
