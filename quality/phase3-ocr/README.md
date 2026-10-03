# Phase 3.2C: local OCR HTTP corpus

This strict diagnostic generates synthetic English and Hindi conjunct/bilingual
scans, then sends their image-only PDFs to the running local application. It
checks actual HTTP responses from OCR PDF and PDF to Word. This is a small
recognition and failure-handling gate, not a universal OCR accuracy score.

## Run

Requirements already used by the project: Python, PyMuPDF, python-docx, Pillow,
LibreOffice, and local Arial/Nirmala UI or Noto Sans/Noto Sans Devanagari fonts.
The application process needs a working Tesseract installation, English and
Hindi traineddata, and OCR enabled. The runner never installs dependencies,
downloads models, loads credentials or changes the server environment.
The Node wrapper discovers an existing ignored project-local Windows OCR
installation and reads only the Python executable setting from `.env.local`.
Use `npm run dev:local-preview` for the no-cost local application profile and
`npm run phase3.2c:ocr-http` for the configured wrapper.

```powershell
python -m unittest discover -s scripts -p test_phase3_ocr_http_corpus.py
python scripts/phase3-ocr-http-corpus.py --generate-only --report tmp/pdfs/phase3.2c-ocr/generation-report.json
python scripts/phase3-ocr-http-corpus.py --base-url http://127.0.0.1:3001
```

Inspect the generated source PNGs before interpreting the OCR scores. Focused
reruns can repeat `--case` and `--tool`, for example:

```powershell
python scripts/phase3-ocr-http-corpus.py --case hindi-conjunct-bilingual --tool ocr-pdf --report tmp/pdfs/phase3.2c-ocr/hindi-recheck.json
```

`--libreoffice` accepts an existing executable path. `--timeout` accepts 1–600
seconds per route (180 default). Only loopback origins are permitted, environment
HTTP proxies are disabled, and cross-origin redirects are refused. Word uses
the synchronous route so a real 422 can be distinguished from a queue failure.
The runner reuses the bounded transport from `phase3-document-corpus.py`.

## Source integrity

1. Literal Unicode paragraphs are written to DOCX. Editable DOCX XML must match
   the original lines exactly before export.
2. LibreOffice renders the source to PDF independently of the application's
   PDF-to-Word and OCR implementations. PyMuPDF must recover the complete
   original text (NFC and whitespace normalization only), and the page count
   must be one. The report records original DOCX and PDF SHA-256 hashes.
3. This trusted PDF is rasterized at 300 DPI. The saved preview PNG is exactly
   the image embedded in the test upload.
4. Every image-only upload page must contain **zero selectable characters**.
   Source text and expected markers are never posted with the file.

LibreOffice correctly shapes the Hindi conjuncts in the visually reviewed
prototype, but some of its exported glyph mappings require `/ActualText` for
correct extraction. The original source text gate therefore explicitly uses
PyMuPDF's ActualText support. It is not evidence that all PDF extractors support
that source. Rasterization removes that dependency from the OCR test input.
Visual review remains a human check, not an assertion inferred from text.

## Eight route checks

| Fixture | Routes | Required result |
| --- | --- | --- |
| Clean English image-only invoice | OCR PDF, PDF to Word | Searchable PDF / editable DOCX, exact selected words and amounts |
| Hindi conjunct and English invoice | OCR PDF, PDF to Word | Exact selected conjuncts, words, identifier and decimal amount |
| Already-searchable English PDF | OCR PDF | Same page count and complete normalized original text preserved |
| Unreadable geometric raster | OCR PDF, PDF to Word | HTTP 422 JSON error; no successful artifact in the response |
| Searchable page followed by unreadable raster | OCR PDF | HTTP 422; no silent partial-success PDF |

Selected markers are exact and occurrence-counted. NFC and whitespace removal
allow run/line breaks; no fuzzy recognition, transliteration, dropped marks,
case correction or numeric tolerance can manufacture a pass. A missing marker,
duplicate marker, wrong decimal, or missing conjunct fails. HTTP 500, 429 and
image-only DOCX are not accepted as expected unreadable-scan behavior.
Numeric markers cannot match inside a longer or differently signed number:
`912345.67`, `12345.670` and `-12345.67` cannot satisfy `12345.67`. A 422 must
also contain the known unreadable-OCR message; password, missing-runtime,
missing-language and invalid-input errors do not satisfy that gate.
Numeric comparisons retain whitespace boundaries and require a contiguous
number; two separate equal amounts count as two occurrences.

PDF output must have PDF magic/MIME, parse correctly, retain page count and have
searchable text on every page. DOCX output must have the correct MIME, valid ZIP
CRC and required Office XML, and preserve the markers in editable document
paragraphs. Image descriptions, comments and metadata do not count. The report
keeps actual extracted text, missing/duplicated markers and output hashes visible.

Raw sources, outputs and previews remain under ignored `tmp/pdfs/phase3.2c-ocr/`.
`latest-report.json` contains only synthetic evidence. Generate-only mode makes
no HTTP calls and reports `summary.allPassed: null`; exit zero in that mode is
not conversion success. A full run exits nonzero for setup, fixture, transport,
format, recognition or expected-error failures, while preserving the report.

## Boundaries

Runner package versions, Tesseract version, model hashes and allowlisted OCR
environment values describe the runner process. Response engine headers are
recorded separately; the runner does not claim it proved the server's model or
environment. Confirm those from server startup/runtime evidence separately.

Other scripts, handwriting, arbitrary degraded scans, large-document load,
layout fidelity, accessibility, real-user documents and production capacity
remain separate gates. No public deployment or paid API is exercised here.
The reviewed Hindi Word output has a visual reference and editable OCR text,
but joined word spacing and changed layout remain visible quality limitations.
Whitespace-normalized marker checks do not measure or resolve those issues.
