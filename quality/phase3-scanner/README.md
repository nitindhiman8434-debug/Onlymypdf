# Phase 3.4 scanner artifact checks

`first-report.json` records 11 actual local HTTP requests: five successful
conversions and six invalid-input rejections. All 11 passed. The five conversions
produce 14 PDF pages; each page was independently rendered with Poppler at 96 DPI.
This report does not itself claim visual sign-off.

`visual-review.json` records the separate 14-page visual inspection and browser
boundary checks. `unit-report.json` retains the 66 passing focused tests.
`verification-report.json` records final source hashes, the successful webpack
build and scope limits. On 7 October 2026 the user explicitly confirmed clicking
Download PDF and saving the file, closing the last manual browser gate. The
automation download timeout is retained as a tooling limitation. The user's
saved file was not independently inspected; the HTTP artifacts have their own
separate byte, geometry and pixel checks.

## What the checks establish

- Original PNG retains every decoded source pixel.
- B&W matches an independent literal grayscale threshold at 128, with only
  0 and 255 output values and no differing channels.
- Enhanced changes a deliberately low-contrast image: its measured P95-P5 gray
  range increases from 49 to 201 while its four gray patches remain in order.
  This is filter behavior on this fixture, not universal readability improvement.
- A phone-style JPEG carrying EXIF orientation 6 becomes upright. The expected
  image comes from Pillow's `ImageOps.exif_transpose`, independently of Sharp.
- Ten distinct JPG/PNG/WebP images produce ten pages in upload order. Each
  embedded page is compared to its own numbered, colored source image.
- Eleven images, an unknown filter, no images, plain text, a truncated PNG,
  and one valid image followed by a truncated PNG all return HTTP 400 JSON
  without a PDF artifact.

Successful downloads must have PDF MIME/magic, a download filename, an openable
unencrypted PDF, the exact page count, A4 portrait page dimensions, the expected
centered image geometry, and no selectable text layer. This scanner makes an
image-based PDF; it does not add OCR or editable Word text.

Lossless PNG/WebP comparisons require exact pixels. JPEG comparisons allow a
mean absolute channel difference of at most 1 and a single-channel difference
of at most 8 for independent decoder rounding. In this run every JPEG comparison
was also exact: the observed maximum and mean differences were both zero.

## Files and reproduction

Runner: `scripts/phase3-scanner-corpus.py`.

Generated sources, independently oriented expected PNGs, downloaded PDFs,
extracted embedded PNGs, and Poppler previews are under ignored
`tmp/pdfs/phase3-scanner/first/`. The report stores paths and hashes.
The 14-page overview is `tmp/pdfs/phase3-scanner/first/output-contact-sheet.png`;
individual full-size output previews are listed in `renderedPreviewPaths`.

With the no-cost local preview running:

```powershell
python -m py_compile scripts/phase3-scanner-corpus.py
python scripts/phase3-scanner-corpus.py --run-label recheck --base-url http://127.0.0.1:3001
```

Use a new run label each time. Existing reports and artifact directories are
never overwritten. The runner rejects non-loopback origins and all redirects,
disables HTTP proxy use, does not import app processing code and never downloads
fonts or tools. Inputs contain synthetic English text only.

HTTP timings are individual local observations, including first-request route
compilation where applicable. They do not establish production latency, capacity,
cost, arbitrary document quality or customer acceptance. These checks do not
establish animated-image behavior, automatic crop, perspective correction,
OCR accuracy or handwriting support.
