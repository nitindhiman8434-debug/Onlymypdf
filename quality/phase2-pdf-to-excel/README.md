# Phase 2.3C PDF-to-Excel semantic gate

Run `npm run phase2.3c:excel-corpus` from the repository root with Python 3 and PyMuPDF installed. The runner generates deterministic PDFs under `tmp/pdfs/phase2.3c`, uses the production `pdfToExcel` service, reopens each XLSX with ExcelJS, and writes `latest-corpus-report.json`. CI uploads the PDF renders and XLSX files for inspection.

The gate checks contiguous editable cells and types rather than accepting ZIP validity alone:

| Case | Semantic requirement |
|---|---|
| Ruled invoice | Four-column rows, quantities, currency values, and accounting negatives |
| Borderless table | Multi-word descriptions, leading-zero IDs, high-precision ID as text, percent values and display format, and formula-like text kept literal |
| Multi-page table | Both pages become worksheets, with the correct rows and numeric values |
| Mixed orientation | Portrait cover content and landscape table content are both retained |
| Image-only table | Conversion fails with an OCR instruction; no empty-success XLSX (HTTP 422 on the local API) |
| Phase 1 real regression | Existing two-page PDF has two worksheets, aligned IDs and numeric amounts |

The source PDFs are visually rendered as PNGs. This controlled corpus is not an accuracy claim for arbitrary PDFs. Complex merged cells, handwriting, scans without a text layer, non-Latin tables, and large/slow production jobs need further measured work. Production browser deployment is tracked separately from the local and Ubuntu semantic gate.
