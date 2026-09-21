# Phase 2.3 Semantic Office Output and OCR

**Started:** 18 September 2026

**Approved output-changing scope:** PDF-to-Word OCR and semantic PDF-to-Excel/PowerPoint accuracy, each started by the user as a separate phase.

**Phase 2.3A status:** 100% complete. Implementation, local Linux container gate and Railway production worker deployment are verified.

**Phase 2.3B status:** 100% complete. The Hindi, mixed-language and difficult-scan corpus passed 8/8 cases on the Ubuntu production-equivalent gate, with rendered source and Word previews.

**Phase 2.3C status:** 100% complete for the controlled PDF-to-Excel semantic gate. Six cases passed locally and on Ubuntu; the local HTTP route returned an openable XLSX and rejected an image-only PDF with HTTP 422. Public production browser behavior remains unverified and belongs to the measured deployment gate in 2.3E.

**Phase 2.3D status:** 100% complete for the controlled PDF-to-PowerPoint semantic gate. Seven cases passed locally and on Ubuntu; the local HTTP route returned an openable PPTX with on-slide editable text, while an image-only scan remained visual-only. Public production behavior remains unverified for Phase 2.3E.

**Phase 2.3E status:** In progress. The production-image dependency gap is addressed in source and CI verification is pending. Public conversion, representative resource limits and per-job cost have not passed their gates.

## Recorded decision gate

| Decision | Phase 2.3A value |
|---|---|
| Target format | PDF to editable Word `.docx` |
| Accuracy benchmark | Valid DOCX, editable text, at least 90% expected-token recall on the deterministic clean-scan case, and no silent image-only success in the production worker |
| Layout benchmark | Existing infographic and 64-page technical-manual cases must continue to pass; scanned output keeps a visual reference of each source page beside visible, editable OCR text |
| Cost ceiling | No paid conversion/OCR API; use the existing Railway worker and open-source PyMuPDF, Tesseract and pdf2docx stack |
| Resource ceiling | One OCR thread, 220 DPI, and at most 50 image-only pages per initial job |
| Output-change approval | User approved starting Phase 2.3 on 18 September 2026 |

## Baseline findings

1. Text-rich manuals already produce editable DOCX output. The 64-page manual gate produced 123,256 characters and 919 media items with `pdf2docx`.
2. Infographic output continues to use Word COM locally and preserves the poster page geometry and media.
3. Image-only PDFs previously returned one page image per Word page. They looked similar but contained no editable OCR text.
4. The production worker image did not contain Tesseract or language data.
5. OCR is compute intensive. PyMuPDF documents that OCR is far slower than normal extraction, so the initial worker uses one OCR thread and a 50-page ceiling.

## Phase 2.3A implementation

- The Railway worker image includes Tesseract with English and Hindi trained data.
- Image-only PDFs first become searchable PDFs with a Tesseract text layer. When `pdf2docx` does not expose that hidden layer as editable Word text, the pipeline creates a two-column Word page with a compressed visual reference and visible editable transcript.
- Production sets OCR as required. If OCR is unavailable, above the page ceiling, or cannot produce a minimum amount of editable text, the Python engine fails instead of silently reporting an image-only DOCX as editable.
- Local development retains the old image-only fallback when Tesseract is not installed, and prints an explicit warning.
- The deterministic benchmark generates its scan at runtime and verifies the actual DOCX package, editable characters and expected-token recall.

## Accuracy boundary

No OCR engine can honestly guarantee 100% recognition for every scan. Handwriting, blur, skew, damaged pages, unusual fonts, equations, complex tables and unsupported languages still need a broader corpus and manual review. The clean printed English gate is the first controlled release slice, not a global accuracy claim.

Phase 2.3B expands that controlled boundary to printed Hindi and English/Hindi scans, skew, low resolution, columns, tables/forms and damaged input. Handwriting remains outside the supported accuracy claim. Completely unreadable input is rejected instead of being returned as an editable success.

## Phase 2.3B implementation

- Production OCR now defaults to `eng+hin`; startup checks confirm that every requested Tesseract language pack is installed before conversion begins.
- The deterministic corpus creates real image-only PDFs and validates the downloaded DOCX package, editable text, embedded visual reference, expected-token recall and a LibreOffice-rendered Word preview.
- Hindi recall scoring handles Tesseract's known removal of spaces between Devanagari words without weakening the required word content.
- Mixed-language fixtures draw each script with a compatible font so the test scans contain real English and Devanagari glyphs.
- A Word result must preserve at least 60% of the recognized OCR text. If `pdf2docx` drops too much text, the pipeline switches to the visual-reference plus editable-transcript output instead of accepting a partial document.
- Table-like scans are detected from long horizontal/vertical grid lines. OCR uses the normal page analysis plus line-removed PSM 6 and PSM 11 analysis; transcripts are deduplicated while the original grid remains visible in Word.
- Production fail-closed cleanup removes a partial DOCX when required OCR cannot meet the editable-text gate.

## Phase 2.3B issues found and resolved

1. **The corpus runner missed its image dependency.** Pillow is now explicitly installed in both the Ubuntu gate and isolated OCR test image.
2. **Mixed-language fixtures contained square placeholder glyphs.** English and Hindi segments now use script-compatible fonts; visual inspection confirms that the source scans contain the intended text.
3. **Correct Hindi text was scored as missing when Tesseract joined adjacent words.** Unicode-aware compact matching now measures the actual Devanagari content.
4. **A damaged scan could pass with only 27 editable Word characters from 132 recognized characters.** The output-to-recognized-text ratio gate forces the fuller transcript fallback.
5. **Table headers were recognized while body rows were lost behind grid lines.** Table-line removal and multi-segmentation transcript merging raised the controlled table/form case to full expected-token recall.
6. **An unreadable scan could have been mistaken for success by an image-only fallback.** Production OCR remains required and returns no valid DOCX for the unreadable case.

## Phase 2.3B verification evidence

| Case | Result | Expected-token recall | Editable characters |
|---|---:|---:|---:|
| Clean printed Hindi | Pass | 100% | 106 |
| Mixed English/Hindi | Pass | 100% | 112 |
| 2.4-degree skewed mixed scan | Pass | 100% | 103 |
| Low-resolution scan | Pass | 100% | 94 |
| Two-column bilingual scan | Pass | 100% | 153 |
| Bilingual table/form | Pass | 100% | 196 |
| Damaged/noisy scan | Pass | 81.82% (60% gate) | 132 |
| Unreadable input | Pass, failed closed | No success expected | 0 |

All seven successful cases produced a valid DOCX, one embedded visual source reference and a rendered Word preview. The unreadable case returned exit code 3 with no valid DOCX. GitHub Actions run `35377888504` passed the 8/8 Ubuntu gate in 59 seconds. The committed machine-readable result is `quality/phase2-pdf-to-word/latest-corpus-report.json`.

## Verification evidence

| Gate | Result | Evidence |
|---|---:|---|
| Clean image-only English scan | Pass | 1.255 s, 57,375-byte DOCX, 233 editable characters, one visual reference and 10/10 expected tokens |
| OCR fail-closed behavior | Pass | With Tesseract absent and OCR required, conversion returns an explicit error and no false-success DOCX |
| Infographic baseline | Pass | Word COM, 56 editable characters, 402 media items and 960 × 540 point page geometry |
| 64-page technical manual baseline | Pass | pdf2docx, 123,256 editable characters, 919 media items and valid DOCX |
| PDF-to-Word regression suite | Pass | 46/46 tests across engine planning, quality gates, retry behavior, hint safety and upload validation |
| TypeScript | Pass | `tsc --noEmit` |
| Python syntax | Pass | `py_compile` for the production converter and OCR benchmark |
| Railway production image | Pass | Deployment `6d1712d8-2569-4611-8975-ad35d71d5d9c` built commit `30841eb`; build logs confirm LibreOffice, Tesseract `eng`/`hin` and `pdf2docx` installation |
| Railway worker runtime | Pass | Deployment reached `Active`; runtime logged `[conversion-worker] ready { pending: 0, processing: 0 }` and cleanup completed without failures |

The committed machine-readable result is `quality/phase2-pdf-to-word/latest-report.json`.

## Phase 2.3 work packages

| Work package | Phase 2 weight | Status |
|---|---:|---|
| 2.3A PDF-to-Word OCR foundation | 8% | Complete: local and Railway production gates passed |
| 2.3B Hindi, mixed-language and difficult-scan corpus | 6% | Complete: 8/8 Ubuntu gate and rendered preview review passed |
| 2.3C PDF-to-Excel semantic accuracy | 8% | Complete: 6/6 Ubuntu semantic corpus and local API artifact gate passed |
| 2.3D PDF-to-PowerPoint semantic accuracy | 8% | Complete: 7/7 local and Ubuntu semantic cases passed |
| 2.3E measured limits, cost and production quality gate | 5% | In progress; no completion credit until public gates pass |

## Remaining Phase 2.3 work

- Handwriting remains unsupported and must not be marketed as accurate without a separate measured corpus.
- Set measured job limits from Railway CPU/memory and cost data rather than advertising unlimited files.
- Measure public deployment behavior, conversion speed, resource cost and support limits in Phase 2.3E.

## Phase 2.3C findings and verification

1. The old Excel extractor could replace the uploaded PDF with a sibling file or a bundled reference table, and its landscape-page shortcut could omit portrait content. Those substitution paths and the page-dropping shortcut were removed. The current extraction reads the uploaded PDF only.
2. Borderless tables split multi-word descriptions into extra columns. PyMuPDF's text-table strategy now runs before the word-position fallback; fully empty phantom columns are removed in ordinary tables.
3. Identifiers with leading zeros and more than 15 significant digits remain text. Quantities and amounts become numeric cells; percentage, currency, and accounting-negative display formats are preserved.
4. Image-only pages previously produced a structurally valid workbook with a “no text” message. They now fail before extraction with an OCR instruction. The local API returns HTTP 422 and no XLSX for that input.
5. Two unrelated test assertions were stale or timing-sensitive: billing checkout copy now tests its actual renewal/one-time meaning, and the public health-route import test has a 15-second timeout. Product billing copy and health-route behavior were not changed.
6. English/Hindi help text incorrectly said the PDF Scanner makes searchable PDFs, although its route only places images into a PDF. The scanner description and PDF-to-Word/Excel FAQs now state the real OCR boundary.

The six-case corpus covers ruled invoices, borderless multi-word tables, multi-page tables, mixed portrait/landscape pages, image-only rejection, and a saved two-page Phase 1 regression PDF. Each successful XLSX was reopened and checked for contiguous editable rows and numeric/text types; source PDFs were rendered and visually inspected. Local result: 6/6. GitHub Actions Ubuntu run [`35632810064`](https://github.com/nitindhiman8434-debug/Onlymypdf/actions/runs/35632810064): success. The existing Phase 2.3B OCR workflows also passed on the same commit. Local Next.js API: HTTP 200 with a 6,636-byte XLSX that openpyxl opened with the expected four rows; scanned input: HTTP 422 with a clear OCR instruction. Full unit suite: 614/614; TypeScript, Python syntax, and production webpack build passed.

The machine-readable corpus result is `quality/phase2-pdf-to-excel/latest-corpus-report.json`. The 6/6 result measures this controlled set, not arbitrary PDF-to-Excel accuracy. Scans need OCR first; complex merged headers, non-Latin tables, and file-size/CPU limits remain unmeasured. Phase 2.3E will measure public production quality, speed, and cost.

## Phase 2.3D PowerPoint implementation and local evidence

The old converter placed a complete PDF-page screenshot on each slide. It copied text only into Notes and an off-slide shape, so visible slide text could not actually be edited. For PDFs with selectable, visible, horizontal text, the local open-source pipeline now removes that text from the rendered background and recreates it as on-slide PowerPoint text boxes at the source positions, sizes and colors. Charts, photographs, page fills and rules stay in the image layer. Pages of different orientations are centered and scaled proportionally on a uniform presentation canvas. Rotated labels remain in the visual background until their editable geometry can be measured reliably.

Image-only scans remain image slides. A full-page image with an invisible OCR layer also remains visual-only, so the converter does not falsely present hidden OCR as editable visible text. A full-page image with genuinely visible PDF text over it still gets editable text boxes. This scope uses the local Python converter rather than the unmeasured paid ConvertAPI path; it does not require a paid conversion API.

The deterministic seven-case corpus includes styled vector slides, a three-page report, mixed portrait/landscape pages, visible text over a photo background, an image-only scan, a full-page scan with invisible OCR, and a rotated label. It reopens each PPTX, checks on-slide editable text and page count, renders it through LibreOffice Impress, verifies visible expected tokens, and compares rendered pages against their source images. Local result: 7/7, with mean absolute pixel difference between 0.36 and 3.33 on the 0-255 channel scale. Source and rendered previews were visually inspected. [GitHub Actions Ubuntu run 35647633767](https://github.com/nitindhiman8434-debug/Onlymypdf/actions/runs/35647633767) passed the same corpus, typecheck and Python syntax gate. The local HTTP route returned a 29,247-byte openable PPTX with three editable text boxes, and a 58,139-byte image-only PPTX with no false editable text. Full unit suite: 614/614; TypeScript, Python syntax and webpack production build passed.

The machine-readable local result is `quality/phase2-pdf-to-ppt/latest-corpus-report.json`. This measures the controlled corpus, not arbitrary PDF-to-PowerPoint accuracy. Text in scanned images, charts, links, forms, rotated labels and unusual font substitutions is not promised as editable. Public production conversion, speed, file-size/CPU limits and deployment Python dependencies remain for Phase 2.3E.
