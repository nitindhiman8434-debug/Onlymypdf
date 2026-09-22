# Phase 2.3E: public-document local QA, 22 September 2026

**Scope:** No-cost loopback preview at `http://127.0.0.1:3001`. Three non-sensitive, publicly available PDFs were downloaded into the gitignored `quality/phase2-production/real-world/` directory. Their contents and Office outputs are not committed. The checked-in reports record source hashes, output hashes and measurements.

## Sources and method

| Shape | Source | Input |
|---|---|---:|
| Dense fillable form | [IRS 2025 Form 1040](https://www.irs.gov/pub/irs-prior/f1040--2025.pdf) | 2 pages, 220,237 bytes, 199 form fields, selectable text |
| Two-column article | [arXiv 2010.12647](https://arxiv.org/pdf/2010.12647) | 8 pages, 197,254 bytes, selectable text and figures |
| Image-only historical scan | [National Archives Declaration scan](https://www.archives.gov/files/historical-docs/doc-content/images/declaration-of-independence.pdf) | 1 page, 2,195,695 bytes, no selectable text |

`python scripts/phase2-real-world-qa.py` uploads each source to the actual local Word, Excel and PowerPoint HTTP routes. It polls and downloads the Word job, saves Office files only under the ignored corpus directory, verifies Office ZIP CRC and required parts, reopens XLSX/PPTX, counts editable text and structures, and compares unique alphanumeric source tokens against editable output text. Run `python scripts/phase2-real-world-visual-check.py` to compare embedded page-reference images with source renders. Pixel difference is measured on a 0–255 RGB scale; it does not assess the final composed Word/PPT layout. Word output quality is also checked visually for the two-page form.

## Defect found and resolved

The first Form 1040 Word job took **188.94 s** and returned the `visual` fallback: an openable DOCX with **zero editable characters** despite 10,497 selectable source characters. This was a misleading success for the site's editable-Word claim. The form contains 199 interactive fields and hundreds of vector drawings; the ordinary geometry-first path did not produce an acceptable editable result on this machine.

The Word hint pass now detects short, dense selectable forms and routes them to a page-reference plus editable-transcript conversion. The form's image reference remains available beside text the user can edit; this is **not** preservation of the original interactive form fields or a pixel-perfect editable form. The normal paths for other PDFs are unchanged. OCR-required mode is explicit in the local preview and is the production default; an image-only scan without a working OCR engine fails with a clear OCR message instead of returning image-only Word as success. The published Word FAQ now explains the dense-form limitation.

| Form 1040 Word gate | Before | After |
|---|---:|---:|
| Local HTTP wall time | 188.94 s | 3.42 s warm; 5.61 s in final full QA run |
| Engine | `visual` | `reference-transcript` |
| Editable characters | 0 | 10,258 |
| Unique source-token recall | 0% | 100% on this source |
| Page visual references | 2 images | 2 images, page-image MAE 2.718 and 2.424 |

The first after-fix HTTP run took 29.14 s including cold Next development compilation; the 3.42 s warm result is not a production p95. The two images were compared to actual PDF renders and visually inspected. The form's transcript is editable, but original boxes, calculations and field behavior do not become Word form controls.

## Final local HTTP observations

| Source / output | HTTP | Time | Content verification | Boundary |
|---|---:|---:|---|---|
| Form → Word | 200 | 5.61 s | Valid DOCX, 10,258 editable chars, 100% unique-token recall, 2 visual references | Transcript editing, not editable form controls |
| Form → Excel | 200 | 18.09 s | Valid XLSX, 2 sheets, 145 populated cells, 78.48% unique-token recall | Some source labels/text omitted; layout and cell semantics need manual review |
| Form → PowerPoint | 200 | 15.50 s | Valid PPTX, 2 slides, 10,490 editable chars, 100% unique-token recall | Editable text overlays a visual background; form controls remain graphics |
| Article → Word | 200 | 19.49 s | Valid DOCX, 39,134 editable chars, 98.29% unique-token recall | Reading order and layout need rendered Word review |
| Article → Excel | 200 | 16.70 s | Valid XLSX, 8 sheets, 2,228 populated cells, 64.45% unique-token recall | Prose-heavy papers are a poor Excel fit; no full-content fidelity claim |
| Article → PowerPoint | 200 | 5.80 s | Valid PPTX, 8 slides, 38,029 editable chars, 99.82% unique-token recall | Visual background plus editable text; final composed slide not rendered here |
| Scan → Word | Job error | 1.08 s | Clear “PDF OCR could not extract editable text” message; no false DOCX success | Tesseract is unavailable in this Windows preview; production OCR was not tested on this scan |
| Scan → Excel | 422 | 0.53 s | Requests OCR before Excel | Expected unsupported image-only input |
| Scan → PowerPoint | 200 | 4.05 s | Valid one-slide PPTX with one image and zero editable text boxes | Intentionally visual-only scan |

The final report is `quality/phase2-production/local-real-world-final-report.json`; the before-fix evidence is `local-real-world-report.json`. All successful outputs had the expected Office MIME type and passed ZIP CRC checks. The embedded form Word page references had RGB mean absolute differences of 2.718/2.424; PowerPoint backgrounds ranged from 0 to 17.263 across these samples. Those background scores do not prove final Office visual fidelity or semantic reading order.

## Remaining Phase 2.3E gates

- This is a **three-document diagnostic**, not a statistical accuracy claim. The Excel omissions and final Word/PPT layout need further review with representative customer documents and an Office renderer.
- The new dense-form path passed local HTTP and webpack checks but has not yet been rerun inside the updated Linux Docker image or Railway worker. The earlier production-image CI run predates this change.
- The local preview lacks Tesseract. Its fail-closed scan result does not validate production OCR accuracy on the National Archives source.
- Public HTTPS frontend, configured cloud storage/queue, deployed load and cleanup evidence, per-tool production limits and actual provider cost per conversion remain pending. The user has chosen not to buy a plan now; no Railway deployment or paid API was triggered by this QA.
- Phase 2.3E is **not 100% complete**. Phase 2 overall remains **62%** until the production gate is resolved or explicitly scoped out.
