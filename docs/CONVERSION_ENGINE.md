# OnlyMyPDF — High-Accuracy Conversion Architecture

The most important product area: get as close as possible to Smallpdf / iLovePDF quality on
PDF→Word and PDF→Excel **without false 100% claims** and while controlling cost.

## The 5 layers

### Layer 1 — Fast Mode (local, cheap)
Open-source engines for simple digital PDFs. Low credits, fast.
- PDF→Word: `pdfplumber`/`pdf2docx` + LibreOffice where helpful.
- PDF→Excel: `camelot` / `tabula` table extraction.

### Layer 2 — Smart Detection (always runs first)
Cheap pre-scan producing a `detection` object stored on the job:
```
digital_vs_scanned, page_count, text_density, image_density, table_pages, has_forms,
multi_column, unusual_fonts, languages[hi/en/…], rotated_pages, encrypted,
complexity_score (0-100), expected_quality (0-100)
```
Drives routing, the credit estimate, and the live quality meter.

### Layer 3 — High Accuracy Beta
Advanced local pipeline **or** commercial API fallback via the provider interface. Credit-based,
shows an estimate before running, validates output. Selected when detection complexity is high or
the user explicitly chooses High Accuracy.

### Layer 4 — Rescue Mode
If Fast Mode output scores weak (low quality estimate / validation fail), offer a retry:
- scanned → OCR first,
- table-heavy → table extraction path,
- configured provider → API fallback.
Extra credits are consumed **only after explicit confirmation**.

### Layer 5 — Benchmark Lab (admin)
Upload test PDFs (resume, invoice, bank statement, table report, scanned, certificate, form,
multi-column, Hindi, English, image-heavy) and compare engines/providers on:
processing time · success/failure · output size · OCR confidence · tables found · pages
converted · user rating · admin rating · engine/provider · error logs.
Backed by `benchmark_files / benchmark_runs / benchmark_results`.

## Provider abstraction (`worker/providers/`)
```python
class ConversionProvider(Protocol):
    name: str
    def supports(self, tool_code: str) -> bool: ...
    def convert(self, job: Job, detection: Detection) -> Result: ...
```
Local engines and each commercial API implement this. The registry picks a provider by tool,
mode, detection, and admin config. **No provider-specific logic leaks elsewhere.**

## Quality estimate (the live meter)
Not a guarantee. A 0–100 estimate combining: digital vs scanned, page complexity, tables, fonts,
forms, images, OCR confidence, and post-run output validation. Surfaced during processing and on
the result page as "Quality estimate", never "guaranteed accuracy".

## Guest sampling
- PDF→Word: first **5 pages**, preview + download, 25 MB guest cap, **no watermark**.
- PDF→Excel: no page-count limit within the 25 MB guest cap; complex/heavy → Pro High Accuracy.
- Translate: first **3 pages**, 1 sample/day. OCR: 5 High Accuracy samples/day.

## AI Summary safety
Public wording: "no page limit". Backend: chunking, timeouts, section summaries for large docs,
queued job, graceful failure. Scanned PDF with no text → ask user to run OCR / High Accuracy.
