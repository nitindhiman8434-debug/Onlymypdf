# Phase 2.3E quality remediation — 22 September 2026

**Result:** The no-cost local Office QA found and corrected three misleading-success paths. Phase 2.3E is still **not 100% complete** because updated Linux production-image OCR and public HTTPS/retention/cost gates have not run. The Phase 2 overall estimate remains **62%**; it is a planning estimate, not a measured conversion-accuracy percentage.

## Before and after

| Area | Before | Current local result |
|---|---|---|
| Dense form Word | Valid but image-only DOCX; 0 editable characters on the IRS sample | Reference page plus editable transcript; 10,258 editable characters and all unique selectable source tokens on that sample |
| Two-column article Word | DOCX text was editable but rendered to 23 badly reflowed pages from an 8-page PDF | Short dense documents choose reference plus editable transcript. The article produced 8 page references, 99.28% source-token recall and a readable 16-page LibreOffice render; page count differs by design. |
| PDF to Excel | Form and article table sheets omitted selectable text; unique-token recall was 78.48% and 64.45% | The table sheets remain, and a separate `Source text` sheet preserves text from pages with incomplete table extraction. Both samples reached 100% unique-token recall **across the whole workbook**, not 100% cell mapping. A new lost-text fixture passes. |
| Dense PowerPoint | Editable text boxes overlapped on rendered article/form slides | Pages above the density threshold retain the original visual page and put selectable text in editable speaker notes. A follow-up fixed duplicated notes text caused by sorted extraction. Simple pages still have editable on-slide text; scans stay visual only. |

The 9-case local HTTP rerun is in `quality/phase2-production/local-real-world-phase2e-final-report.json`: seven valid Office downloads, a clear OCR-required Word failure for an image-only scan on this Windows preview, and a clear Excel OCR-required rejection. All successful files passed Office ZIP CRC/openability checks. Form/Article PPT notes contain 10,494/38,070 characters, with no text box overlap on those dense slides; their selectable-text token recall is 100% on these two PDFs. Article Word token recall is 99.28%. These are diagnostics, not a guarantee of semantic order or visual fidelity. The page-reference-only pixel comparison is in `local-real-world-visual-phase2e-report.json`. A LibreOffice rendering of the article PPT was visually inspected and preserved the two columns without overlap.

The controlled Excel corpus passed **7/7**, PowerPoint corpus passed **8/8**, including new lost-text and two-column cases. The new full-image smoke script passed its local reference-transcript branch. The Linux OCR branch is prepared in CI but remains unrun for this change. The full web image now installs English/Hindi Tesseract packages, matching the worker's OCR runtime; the code change alone is not proof that the rebuilt image or OCR output works.

## Remaining exit gates

1. Build and run the updated full Linux image; verify English/Hindi Tesseract and the synthetic scan-to-editable-DOCX smoke inside it. Docker Desktop's daemon is unavailable on this machine and Windows denied starting `com.docker.service`, so this check did not run locally.
2. Verify downloaded Word/PPT layout in Microsoft Office as well as LibreOffice on representative customer-owned documents. The public samples and synthetic corpus do not establish universal accuracy; Excel source-text backup does not repair wrong cell mapping.
3. Deploy a public HTTPS frontend connected to Supabase, Upstash and R2; run all three Office flows, failure cleanup and retention in that actual environment. The user currently wants no paid plan, so no public deployment or paid API use was initiated in this checkpoint.
4. Measure deployed small/typical/large realistic jobs and concurrency: p95 latency, memory/CPU, queue time, timeout/OOM, disk, storage/Redis/database use and per-job cost. Only then set per-tool supported size caps. The declared Free/Pro caps remain 25/200 MiB; those are transport rules, not universal processing guarantees.

**Gate decision:** local quality improvements are reproducible; Phase 2.3E production launch gate remains open. Do not claim 100% accuracy, unlimited file sizes, production OCR success, or a dependable no-cost global launch from these local results.
