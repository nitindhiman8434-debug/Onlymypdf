# Phase 2 advanced PDF tools checkpoint

**Started:** 24 September 2026

**Scope:** Repair PDF, OCR PDF, PDF/A, Redact PDF, Crop PDF and Compare PDF.

**Status:** Complete for the controlled engineering gate. Local HTTP/artifact checks and [GitHub Actions production-image run 35916532239](https://github.com/nitindhiman8434-debug/Onlymypdf/actions/runs/35916532239) passed. This contributes the full 20% workstream weight, bringing Phase 2 overall to 82%.

## Delivered behavior

| Tool | Implemented behavior | Published boundary |
|---|---|---|
| Repair PDF | Rebuilds readable PDF structure and writes a clean copy with PyMuPDF. | Missing bytes and severely corrupted pages cannot be recreated. |
| OCR PDF | Adds searchable Tesseract text to image-only pages and preserves pages that already contain usable text. English, Hindi and combined mode are available. | Maximum 50 pages. Printed text is the supported target; handwriting, blur and damaged scans require review. |
| PDF to PDF/A | Uses Ghostscript plus an sRGB output profile for PDF/A-1b, 2b or 3b output. | Receiving archives can impose additional validation rules; the UI does not claim universal acceptance. |
| Redact PDF | Removes exact matching selectable text using PDF redaction annotations and writes a new file. | Scanned images, annotations, metadata, embedded files and alternate spellings need separate review. |
| Crop PDF | Applies top, right, bottom and left percentage margins through each page CropBox. | Cropping changes the visible area and is not secure content removal. |
| Compare PDF | Renders corresponding pages and creates a three-panel PDF report with document A, document B and highlighted visual differences. | Maximum 50 pages and 25 MB per input. It is a visual aid, not authenticity or legal-equivalence certification. |

These operations use a new isolated Python service. Existing Word, Excel, PowerPoint, merge, split and compression conversion algorithms were not changed.

## Issues found and resolved

1. The shared conversion page always reused the source extension-derived filename. An optional result-name builder now gives each PDF-output tool a clear suffix without changing existing defaults.
2. Compare PDF needs a second input. Its process button stays disabled until both files are selected, and the API validates the second file's type, size and PDF magic bytes.
3. A white cover is not a secure redaction. The new redaction path applies actual PDF redactions and the copy explicitly requires review of scans and hidden data.
4. Cropping could be mistaken for deletion. The page, SEO and FAQ copy all state that CropBox content can remain in the file.
5. PDF/A could falsely imply regulatory acceptance. The page supports named conformance targets and tells users to validate against the receiving archive's rules.
6. The production image lacked Ghostscript. `Dockerfile.full` now installs and startup-checks Ghostscript, the advanced tool script and the sRGB ICC profile.
7. The six new slugs initially had no Hindi FAQ coverage. Entries were added and the repository's all-tools FAQ coverage test passes.
8. An existing animated homepage label blended to a 3.18:1 contrast ratio during transitions. The label color is darker and the focused Hindi-homepage contrast check now passes.
9. The first Linux image gate found that Ghostscript 10 rejects the legacy `-dUseCIEColor` flag. The converter now uses Ghostscript's supported RGB color-conversion option without that retired flag; the first failed run is retained as defect evidence.
10. The second image gate then exposed Ghostscript SAFER blocking the ICC profile read. Following [Ghostscript's file-access guidance](https://ghostscript.readthedocs.io/en/gs10.03.1/Use.html), the converter grants read access only to the selected profile with `--permit-file-read`; it does not disable SAFER. The third image run passed.

## Local verification evidence

| Gate | Result |
|---|---|
| Five real localhost HTTP routes | Repair, Redact, Crop, OCR and Compare returned HTTP 200 with `application/pdf`, attachment filenames and `%PDF-` magic. |
| Artifact inspection | Redacted text was absent; CropBox dimensions changed; OCR/searchable text remained extractable; compare report opened with the expected page count. |
| Direct Python backend smoke | Repair, OCR, Redact, Crop and Compare produced inspected PDFs. PDF/A is intentionally deferred to the Linux image because local Windows has no Ghostscript. |
| Production webpack build | Passed; all six pages and all six API routes appear in the route manifest. |
| Unit/integration regression | 641/641 tests passed across 130 files. |
| Automated accessibility | All six new pages passed serious/critical WCAG and color-contrast checks. The overall run was 40/41 before the unrelated Hindi-homepage contrast fix; its focused retest passed. |
| Source checks | TypeScript, Python compile, JSON translation parsing and `git diff --check` passed. |

## Production-image exit gate

GitHub Actions built `Dockerfile.full` and ran `scripts/phase2-advanced-tools-smoke.py` inside the image. The passing gate created controlled PDFs and verified output magic, openability, page counts, searchable OCR text, removed redaction text, changed CropBox, a detected visual comparison change, and PDF/A output intent. This is runtime proof for the controlled corpus, not universal accuracy for arbitrary PDFs.

## Remaining external evidence

- A real screen-reader review remains outside the automated accessibility gate.
- A public HTTPS deployment, representative production load, retention observation and cost-per-job measurements remain in Phase 2.3E. Google Cloud currently has no linked billing account, so Cloud Run cannot be enabled without changing the user's no-paid-plan decision.
- Verified customer feedback requires real consented users and cannot be synthesized as engineering evidence.
