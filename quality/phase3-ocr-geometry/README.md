# Phase 3.2E English OCR physical page geometry

This small synthetic corpus posts PDFs to the actual local `/api/tools/ocr-pdf`
route with `languages=eng`. It imports only `LocalTransport` from the existing
document corpus: loopback origins only, proxies disabled, bounded downloads and
same-origin redirects. It never invokes Tesseract directly, downloads fonts, calls
paid services or generates non-English fixtures.

Run from the repository root with Python, PyMuPDF and Pillow already installed:

```powershell
python -m unittest discover -s scripts -p test_phase3_ocr_geometry_corpus.py -v
python scripts/phase3-ocr-geometry-corpus.py --generate-only --report tmp/pdfs/phase3.2e-ocr-geometry/fixtures.json
python scripts/phase3-ocr-geometry-corpus.py --report quality/phase3-ocr-geometry/before.json
python scripts/phase3-ocr-geometry-corpus.py --report quality/phase3-ocr-geometry/after.json
```

The default origin is `http://127.0.0.1:3001`. Start the approved local application
separately. `--case letter-portrait` selects one case; repeat `--case` to select
several. `--timeout 180` bounds each HTTP request. Existing JSON reports are refused
so baseline evidence cannot be silently overwritten. Every run has its own ignored
artifact directory under `tmp/pdfs/phase3.2e-ocr-geometry/`.

The recorded `before.json`, `after.json` and `final.json` already exist. Use a new
report name such as `recheck.json` for a new run. Before/final passed **1/5 and
5/5** respectively. The intermediate `after.json` records the visual resampling
failure that led to preserving the original scanned page instead of replacing
its visible image. No comparison threshold was relaxed.

Five cases cover US Letter portrait, fractional A4, landscape, a three-page mixed
document with rotated/CropBox pages, and an already searchable rotated/CropBox
page. Original literal English text is checked against the source PDF before
rasterizing at 300 DPI. Scanned inputs must contain zero selectable characters;
the searchable case keeps its original PDF.

Each successful HTTP response must have PDF MIME and magic, reopen without a
password, preserve the exact page count and full normalized text on every page in
the same order, and include the expected final page. Text normalization uses NFC
and collapses whitespace runs to one space; it retains word boundaries, case and
punctuation. Expected physical dimensions come from each original source
`page.rect`, within **0.05 points**. Extracted word rectangles are transformed by
the page rotation matrix and must stay inside the visible page within 0.5 points.

Before/after PNGs use **96 DPI** with identical pixel dimensions. Raster comparison
requires mean absolute gray error at most 2/255, at most 2% of pixels differing by
more than 32/255, and at least 0.80 intersection-over-union of dark pixels (gray
below 200). These tolerances permit antialiasing after OCR rasterization; review
the recorded PNGs visually as well. OCR pages may normalize CropBox/Rotation
metadata while preserving visible orientation and size. The searchable
passthrough case additionally requires original boxes and rotation.

Final implementation also preserves original boxes and rotation for image-only
pages; only pages with sparse existing text keep the normalized raster path to
avoid duplicate text. Separate `independent-render-report.json` records exact
visible-pixel matches for all seven pages using Poppler at 96 DPI. Every final
output PNG was visually reviewed. `rejection-report.json` records two local
unreadable-input checks returning422 without a PDF artifact. See
`docs/PHASE_3_2E_OCR_PDF_GEOMETRY.md` for the implementation and verified boundaries.

Offline tests deliberately reject the observed 612 x 792 to 1402.5 x 1815 size
regression, swapped pages, missing words, a missing last page and non-PDF output.
They do not run OCR or contact HTTP. This corpus is a narrow local regression,
not evidence for production capacity, noisy scans, handwriting or other languages.
