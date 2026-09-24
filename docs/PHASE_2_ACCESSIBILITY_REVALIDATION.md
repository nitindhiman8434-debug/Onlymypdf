# Phase 2 accessibility revalidation

**Date:** 24 September 2026  
**Branch:** `phase1-dependable-beta`  
**Scope:** browser keyboard behavior, browser accessibility tree, WCAG 2 A/AA Axe rules, color contrast and a local NVDA 2026.2 review. Conversion engines and output behavior were not changed.

## Result

The no-cost local engineering gate is complete for the current public routes. An official portable NVDA 2026.2 session exercised the homepage, upload controls, Watermark, Scanner, authentication validation and both PDF-to-Word result paths. The session found one real defect: a conversion error was announced automatically, while the shared success panel was not. The shared panel now mounts an atomic assertive alert containing the success title and description. NVDA announced the complete message without moving focus.

Phase 2 is now **90%** complete and the accessibility workstream is **20/20**. The foreground auditory/usability sign-off was completed with NVDA 2026.2 and Google Chrome 153.0.8010.53. Phase 2 still has 10% outside accessibility: 5% measured semantic-production limits and 5% real consented customer feedback.

## Issues found and resolved

1. **Add Watermark controls had visible labels without programmatic associations.** Watermark text, opacity, font size and rotation now have stable IDs, names and bound labels. The programmatically opened color picker is removed from the Tab order while its labelled trigger remains keyboard accessible.
2. **PDF Scanner selected mode did not meet contrast requirements.** White 12 px text on teal-600 measured 3.66:1. Text buttons now use teal-700 with a teal-800 hover state and pass the 4.5:1 WCAG AA threshold.
3. **PDF Scanner did not announce the active Camera/Upload mode.** The two controls are now a labelled group with an `aria-pressed` state that updates through keyboard activation.
4. **One combined local run exhausted the Chromium renderer heap.** The first 37 checks passed, then the Split PDF contrast scan hit `V8 JavaScript OOM`; later failures were connection-refused cascades after localhost stopped. Split PDF and every affected route passed when rerun in fresh memory-safe batches. This was test infrastructure pressure, not a product contrast failure.
5. **Tool success panels were visible but not announced automatically by NVDA.** `ToolSuccessPanel` now mounts a screen-reader-only atomic `role="alert"` with the complete success title and description. This fixes success announcements for PDF to Word and every tool that shares this result component, without changing conversion logic, output bytes or timing.

## Verification evidence

| Gate | Result | Evidence |
|---|---:|---|
| Keyboard interactions | Pass | 11/11 Playwright checks in memory-safe batches, including Watermark labels/tab order, Scanner pressed-state changes, 200% zoom-equivalent reflow and forced-colors mode |
| Serious/critical Axe findings | Pass | 0 across 40 English/Hindi public pages, including all 28 PDF tool routes |
| Color contrast | Pass | 0 moderate-or-higher violations across 37 marketing/tool checks, including all 28 PDF tool routes |
| Browser accessibility tree | Pass | Skip link focuses `#main-content`; Watermark fields expose Text field/Slider/Stepper names; hidden color input is skipped; Scanner controls expose distinct accessible names |
| Add Watermark targeted retest | Pass | Serious/critical Axe check and keyboard semantic checks pass |
| PDF Scanner targeted retest | Pass | Serious/critical Axe, color contrast and keyboard pressed-state checks pass |
| NVDA 2026.2 core flow | Pass | Real speech log captured landmarks, upload names, Watermark names/values, Scanner pressed states, login/signup alerts, invalid-conversion alert and the valid-conversion success alert |
| Valid PDF-to-Word result | Pass | Tracked 2.3 KB fixture produced a real 36.8 KB DOCX result; NVDA spoke `alert, Converted Successfully! Your Word document is ready to download.` and the foreground user confirmed hearing it |
| Unit regression suite | Pass | 133 files and 653 tests passed after the live-region repair |
| Production build | Pass | Next.js 16.3.5 webpack build generated 168/168 pages |
| 200% reflow proxy | Pass | 1280 px viewport represented as 640 CSS px; primary heading and actions remained visible with no horizontal document overflow |
| Windows High Contrast proxy | Pass | Chromium `forced-colors: active` matched and the primary Select file action remained visible and keyboard-focusable |

The expanded automated suite now contains **88 checks**: 40 Axe structure/name checks, 37 contrast checks and 11 keyboard behavior checks. On a memory-constrained Windows development server, run the Axe and keyboard groups in smaller batches. One combined 11-check keyboard run crashed Chromium after three passes; the unchanged remaining checks passed 6/6 and 2/2 in fresh batches. This was runner memory pressure, not a product failure.

## NVDA session evidence

The official NVDA 2026.2 installer was downloaded from NV Access and matched its published SHA-256 checksum (`f3f8d29974a88d687b3c4809be192219ec579c5bdabcda5aaf53635288bca824`). A portable copy ran with an isolated temporary profile and I/O speech logging enabled. The final foreground test used Google Chrome 153.0.8010.53. The full raw log is intentionally not committed because it also records unrelated foreground desktop activity.

| Route/control | Spoken or observed result | Result |
|---|---|---:|
| `/` landmarks and skip link | `Skip to main content`, `main landmark`, one level-one heading; activating the skip link focused `#main-content` | Pass |
| `/merge-pdf` upload | `or drop files here`, `region`, `Select file`, `button` | Pass |
| `/pdf-to-word` upload | `Drop a file here or click to browse`, `region`, `Select file`, `button` | Pass |
| `/add-watermark` | `Watermark text`, `Opacity (50%)`, `Font size`, `Rotation`; the hidden native color input was absent from Tab order | Pass |
| `/pdf-scanner` | `Scanner input mode`, `Camera`, `toggle button`, `not pressed`; `Upload`, `toggle button`, `pressed`; states changed after keyboard activation | Pass |
| `/login` and `/signup` | Required field names followed by `Please fill out this field`, `alert`; focus moved to the invalid field | Pass |
| Invalid PDF conversion | `0% complete`, then `alert`, `File content does not match the declared type.` | Pass |
| Valid PDF conversion | Real DOCX result completed; pre-fix NVDA log proved the missing automatic success announcement. After the assertive-alert repair, NVDA logged and spoke `Converted Successfully! Your Word document is ready to download.` without moving focus; the foreground user confirmed hearing the run | Pass |

## Completed release sign-off

On 24 September 2026, a foreground user ran the tracked valid conversion with NVDA 2026.2 and Google Chrome 153.0.8010.53. NVDA's I/O log recorded `alert, Converted Successfully! Your Word document is ready to download.`, and the user confirmed the audible result. Focus remained in the existing browser flow. This closes the accessibility workstream at 20/20.

The repeatable local runner is `npm run test:a11y:nvda`. It requires the localhost app on port 3001 and a foreground NVDA session; its synthetic fixture does not contain customer data.
