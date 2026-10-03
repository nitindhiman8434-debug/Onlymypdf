# Phase 3.2E: searchable PDF physical page size

**Date:** 3 October 2026

**Status:** Scoped task complete locally. Production launch remains deferred.

**Scope:** Preserve visible page size and orientation when adding OCR to English
scanned PDFs. Local verification only; no paid APIs, public deployment or Hindi
page changes.

## Problem

An actual local OCR request converted a 612 x 792 point Letter scan into a
1402.5 x 1815 point searchable PDF. The image still looked proportional when a
viewer fitted it to the window, but its physical print size was incorrect.

`pdf-advanced-tools.py` used a rendering matrix corresponding to 220 DPI.
PyMuPDF produced the intended 1870 x 2420 pixels, but retained 96 DPI in the
pixmap metadata. Its OCR PDF writer interpreted those pixels at 96 DPI and
enlarged the physical page by 220/96. This affected OCR-generated pages; the
existing searchable-page passthrough branch copied source pages correctly.

Using correct DPI alone is insufficient for fractional dimensions: raster pixel
rounding makes a 595.27557 x 841.88977 point A4 page approximately 595.30909 x
842.07273 points. Output placement must also retain the exact source rectangle.

## Correction and contract

Render with explicit DPI metadata. On image-only pages, copy the original page
and import only the recognized searchable text, removing the recognizer's
replacement raster from its separate temporary PDF. The original scan therefore
keeps its sharpness, MediaBox, CropBox and rotation. The OCR text layer is fitted
to the exact source geometry; placement accounts for the rotation that the OCR
raster already included. No source image is deleted or re-encoded by this branch.

Pages with a small amount of existing selectable text retain the raster output
path, fitted to exact visible dimensions with normalized boxes and rotation.
Copying their original text alongside the recognized text would create duplicates.
The existing 20-character passthrough threshold is unchanged. Pages above that
threshold retain their original boxes, rotation and content through the existing
copy path. No recognition language, DPI setting, page limit or quality gate changed.

A recognizer result with an unexpected page count must fail instead of silently
dropping pages. Existing unreadable-page and runtime error handling remain in place.

## Verified results

The unchanged five-case corpus passed **1/5 before the fix** and **5/5 finally**.
An intermediate exact-size correction passed 4/5: two mixed-document pages
still showed resampling differences from substituting the OCR raster. Preserving
the original image-only page fixed that issue without relaxing any validator.

| HTTP case | Pages | Final result | Local conversion time |
| --- | --- | --- | --- |
| US Letter portrait | 1 | Exact 612 x 792 pt, full searchable text | 3.219 s |
| Fractional A4 | 1 | Exact original fractional dimensions | 1.765 s |
| Landscape | 1 | Exact 792 x 612 pt | 1.719 s |
| Cropped/rotated mixed document | 3 | All sizes, orientation, text and last page preserved | 2.344 s |
| Already-searchable cropped/rotated page | 1 | Original boxes, rotation and content preserved | 0.890 s |

All seven output pages also have correct PDF MIME/magic, readable PDFs, complete
normalized English text in order, correct page count and searchable word boxes
inside the visible page. Independent Poppler rendering at 96 DPI produced
**identical visible pixels on 7/7 source/output page pairs**. All seven output
PNGs were visually inspected: upright readable text, correct portrait/landscape
orientation, no clipping or duplicated content. Poppler emitted nonfatal optional
font warnings for Symbol/ArialUnicode; all renders completed and pixel comparisons
were exact for these English fixtures.

- Geometry integration contracts: **8/8**, including all four quarter-turn
  rotations, nonzero crop offsets, fractional dimensions, sparse-text duplicate
  prevention, unexpected recognizer page count and unreadable later pages.
- Existing OCR output/failure contracts: **8/8**.
- Corpus validator tests: **9/9**.
- Existing TypeScript service/API error contracts: **7/7**.
- Actual unreadable-input smoke requests: **2/2**, returning the correct 422
  message and no PDF, including a readable first page followed by an unreadable page.
- Independent final code review found no actionable issue.

These are **32 focused automated tests**, five successful HTTP conversions and
two negative HTTP checks. Timings are individual local observations, not production
latency percentiles. No fresh full-project build, unrelated full-suite run or
browser-click verification is claimed for this Python conversion change.

Evidence under `quality/phase3-ocr-geometry/`: `before.json` (initial failures),
`after.json` (intermediate visual failure), `final.json`, `rejection-report.json`
and `independent-render-report.json`. Generated PDFs and PNGs are under ignored
`tmp/pdfs/phase3.2e-ocr-geometry/`. The new GitHub workflow runs the Python contracts;
live local HTTP and independent render evidence are separate.

## Reproduce

Start the existing local preview with `npm run dev:local-preview`, then:

```powershell
npm run phase3.2e:geometry-tests
npm run phase3.2e:validator-tests
python -m unittest discover -s scripts -p test_pdf_advanced_tools.py
npm run phase3.2e:ocr-geometry -- --report quality/phase3-ocr-geometry/recheck.json
npx vitest run src/lib/services/advanced-pdf-tools.service.test.ts src/lib/api/tool-route-ocr-errors.test.ts
```

The geometry unit tests substitute only the recognizer result, exercising real
PDF rendering and the production OCR function. Live recognition and HTTP output
are verified separately. The corpus checks exact English text, visible size,
page order/count, word bounds and fixed-resolution rendered pixels. Rendered
source/output pages require a final visual inspection as well.

Choose a new report filename for each repeat; existing evidence is never overwritten.

## Limits

This fixes physical size and image-only scan appearance, not arbitrary recognition
accuracy or PDF accessibility. Sparse-text raster output can still have resampling
differences and normalized boxes. Copied image-only pages retain their source PDF
resources; OCR is not sanitization or irreversible crop/redaction. Preservation of
interactive forms, links and annotations was not independently verified here.
Local timings and controlled English fixtures do not establish public capacity,
uptime or production cost. Real-customer evidence and deferred launch gates
remain open; native Word table/graphic reconstruction is a separate task.

**Next bounded English task:** reconstruct scanned invoice rows as native editable
Word table cells, with strict amounts and row-association checks. Hindi pages and
Hindi-specific improvements remain on hold.
