# Phase 2.3 Semantic Office Output and OCR

**Started:** 18 September 2026

**Approved output-changing scope:** PDF to Word DOCX accuracy and scanned/image-only PDF OCR readiness.

**Phase 2.3A status:** 100% implementation and local Linux container gate complete; Railway deployment verification pending.

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

The committed machine-readable result is `quality/phase2-pdf-to-word/latest-report.json`.

## Phase 2.3 work packages

| Work package | Phase 2 weight | Status |
|---|---:|---|
| 2.3A PDF-to-Word OCR foundation | 8% | Local implementation gate complete; Railway deployment verification pending |
| 2.3B Hindi, mixed-language and difficult-scan corpus | 6% | Pending |
| 2.3C PDF-to-Excel semantic accuracy | 8% | Pending |
| 2.3D PDF-to-PowerPoint semantic accuracy | 8% | Pending |
| 2.3E measured limits, cost and production quality gate | 5% | Pending |

## Remaining Phase 2.3 work

- Verify the full Railway worker image and runtime after deployment.
- Add Hindi and mixed-language corpus cases before enabling `eng+hin` by default.
- Add skew, low-resolution, multi-column, tables, forms, handwriting and damaged-scan cases.
- Set measured job limits from Railway CPU/memory and cost data rather than advertising unlimited files.
- Extend the same semantic gates to PDF to Excel and PDF to PowerPoint.
