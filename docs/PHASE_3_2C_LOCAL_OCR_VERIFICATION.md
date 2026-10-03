# Phase 3.2C: local OCR recognition and failure handling

**Date:** 3 October 2026

**Status:** Complete for the local OCR recognition, routing and failure-handling
scope. OCR Word layout/spacing and production launch gates remain open.

This task continues Phase 3.2B with actual OCR on synthetic English and Hindi
scans, including Devanagari conjuncts. The interface remains English. No paid
API, public deployment or cloud service is required for this local test scope.

## Local runtime

The Windows project now has a current-user Tesseract installation under ignored
`.local-tools/tesseract/`. `npm run dev:local-preview` discovers that runtime
and its English/Hindi data without changing the machine's PATH. Explicit
external OCR configuration takes precedence. The preview clears ConvertAPI's
secret as well as its existing remote-service settings and limits OCR to one
OpenMP thread. `PDF_TO_WORD_PREFER_PDF2DOCX=1` pins this preview to the locally
verified Python engine (or its existing dense-form reference-transcript path),
without paid or Word COM fallback. Missing Python returns HTTP 503. The cloud
configuration in `.env.local` is untouched.

The downloaded executable's SHA-256 matched the digest published for the
[Tesseract 5.5.3 release](https://github.com/tesseract-ocr/tesseract/releases/tag/5.5.3).
Its Windows build is linked by the
[UB Mannheim project](https://github.com/UB-Mannheim/tesseract/wiki), which is
referenced by the [official installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html).
This is a local dependency, not a committed binary or a deployed server runtime.

| Item | Version / SHA-256 |
| --- | --- |
| Tesseract executable release | `5.5.3.20260724` |
| Installer | `bee9e3434bd94fd65387d9be28cd467a41f61b1275383b55b0f59a1331270ae4` |
| Official tessdata_fast revision | `87416418657359cb625c412a48b6e1d6d41c29bd` |
| English model | `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` |
| Hindi model | `4c73ffc59d497c186b19d1e90f5d721d678ea6b2e277b719bee4e2af12271825` |

The model files came from immutable URLs in the official
[tessdata_fast repository](https://github.com/tesseract-ocr/tessdata_fast/tree/87416418657359cb625c412a48b6e1d6d41c29bd).
For a different machine, install Tesseract plus `eng`/`hin` and configure
`TESSERACT_PATH` and `TESSDATA_PREFIX`, or use the same project-local layout.
Restart the preview after adding or changing runtime environment settings.

## Source and scoring contract

Literal Unicode is written to DOCX, rendered by LibreOffice, checked against the
source text through PyMuPDF, and visually inspected. The recognition fixtures
are then rasterized PDFs containing **zero selectable text**. The preservation
and mixed-page fixtures intentionally include selectable text. Expected answers are never
sent to the conversion API. The original PDF uses ActualText for some Hindi
glyphs; rasterization removes that dependency from the tested OCR input.

Eight real HTTP checks cover clean English and Hindi/bilingual conversions to
searchable PDF and editable Word, preservation of already-searchable content,
unreadable rejection for both routes, and a mixed readable/unreadable PDF.
Selected amounts and identifiers require numeric-token boundaries; an extra
leading digit or decimal digit cannot pass by substring match. Unreadable cases
must return the specific readable-text error with HTTP 422 and no successful
artifact in the HTTP response; this check does not audit persisted temporary files.

See `quality/phase3-ocr/README.md` for detailed reproducibility and limits.

## Issues found through actual conversions

1. The searchable-PDF tool could return a successful file even when a raster
   page yielded no text. It now checks every OCR-processed page before saving.
2. Word's OCR-required error cause was lost across engine fallbacks. Verified
   unreadable content is now 422, missing runtime/language data is 503, and
   unexpected internal failures remain 500. The searchable-PDF route uses the
   same distinction.
3. The first HTTP run exposed a Windows routing defect: small compressed scans
   were not classified as image-only. Word COM returned only the Latin text in
   the Hindi sample and accepted an unreadable scan as an image-only DOCX.
   Classification now uses actual per-page text, independently of compressed
   file size. Required OCR routes image-only input through the guarded Python
   converter and cannot fall back to a success without recognized text.
4. A fresh selectable-text regression exposed corrupted glyph mappings in all
   six Word COM outputs on this machine, while Excel/PowerPoint passed. The
   previous passing Word evidence used pdf2docx. The local preview now explicitly
   selects that verified engine. This fixes engine selection for the no-cost
   local profile; it does not claim to repair Microsoft's converter or validate
   every production engine. The initial failing report remains in the local
   evidence directory as `selectable-regression-report.json`.

## Reproduce

```powershell
npm run dev:local-preview
# In another terminal:
node --test scripts/local-ocr-runtime.test.cjs
npm run phase3.2c:validator-tests
npm run phase3.2c:ocr-http
```

The machine-readable OCR result is `quality/phase3-ocr/latest-report.json`.
The final Office regression result is
`quality/phase3-ocr/selectable-regression-report.json`. Raw sources, outputs and
previews remain under ignored `tmp/pdfs/phase3.2c-ocr/`.

## Final measured results

The final no-cost preview passed all eight actual OCR HTTP checks, including
the exact selected Hindi conjuncts and amounts. All eighteen selectable Office
checks also passed (Word 6/6, Excel 6/6, PowerPoint 6/6). The validators and
expected text were not relaxed to obtain those passes.

| Validation | Result |
| --- | --- |
| Actual local OCR HTTP conversions and rejection cases | 8/8 |
| Existing multilingual/selectable Office HTTP corpus | 18/18 |
| OCR corpus validator unit tests | 19/19 |
| Searchable-PDF Python failure/preservation tests | 8/8 |
| Local OCR environment helper tests | 5/5 |
| Earlier clean-English OCR benchmark | Passed; selected token recall 1.0 |
| Final full Vitest suite | 762/762, 144 files |
| Production webpack build and TypeScript | Passed; 169/169 pages |
| Touched-file ESLint, workflow YAML and whitespace checks | Passed |

One intermediate full-suite run timed out while loading unused rendering
dependencies inside a new test under concurrent build load. The test now mocks
those unselected engines and loads modules in setup; no timeout or assertion
was weakened. The final full-suite run passed. The build retains non-blocking
framework/Buffer deprecation warnings. Remote CI has not been counted as a pass.

The browser OCR flow also succeeded. The downloaded PDF was 144,991 bytes,
opened as a one-page PDF and contained 205 extracted characters; the selected
Hindi conjuncts and `12345.67` were present. Screenshot evidence is
`tmp/pdfs/phase3.2c-ocr/browser-ocr-success.png`. This verifies an actual downloaded
artifact, not just a successful button state. Word was separately rendered
through LibreOffice; its visible limitations are recorded below.

## Boundaries

This controlled test does not establish arbitrary OCR accuracy, handwriting,
all scripts, difficult scans, layout fidelity, public load or production cost.
The Hindi OCR DOCX was opened through LibreOffice and rendered: it contains a
visual reference and editable recognized text, but some Hindi word spacing is
joined and the layout differs from the original. Selected marker recognition
passes do not close Word layout/spacing quality. LibreOffice's Windows executable
metadata was 26.2.4.2; its CLI version field was unavailable in the JSON report.
The historical Phase 2 difficult-scan corpus was not rerun successfully on this
Windows setup: it expects a standalone Nirmala TTF, while this machine has a
font collection and Pillow lacks RAQM shaping. The new LibreOffice source
generation avoids making an invalid Hindi raster fixture look like an OCR defect.
The earlier Linux corpus remains historical evidence; it is not counted as a
fresh local pass. Real-customer and production launch gates remain open.
