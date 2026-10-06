# Phase 3.5: publish PDF Scanner evidence

**Date:** 7 October 2026

**Status:** Complete for this scoped local publication task.

## Scope and roadmap

This bounded task continues the existing Phase 3 roadmap item to publish
benchmark reports and useful educational content. It is not another master
phase or a new conversion-engine project. The user confirmed the Phase 3.4
browser download and asked to start the next task on 7 October 2026.

The existing `/benchmarks` page now includes `#scanner-results`, with a section
navigation link, a Dataset entry and links to PDF Scanner and the scanned-PDF
guide. The English Scanner page links back to these results and limitations.
The original Office baseline, OCR-stub disclosure, document corpus and four
English OCR datasets remain intact.

## What is published

The retained Phase 3.4 corpus is shown as three separate kinds of evidence:

- 5/5 successful image-to-PDF conversion cases.
- 6/6 invalid-input rejection checks, returning JSON errors without PDFs.
- 14 output pages independently rendered with Poppler.

The five successful cases cover Original pixels, the B&W threshold, an
Enhanced low-contrast fixture, EXIF photo orientation and ten mixed-format
images in page order. Rejection checks include an eleven-image batch, an
unknown filter, an empty upload, a non-image file, a truncated image and a
valid-plus-corrupt batch. Eleven HTTP checks are not described as eleven
successful conversions.

The measurement timestamp remains **6 October 2026 UTC**, equivalent to
7 October in India. Publishing the summary or confirming a manual save does
not create a new conversion measurement date. The Enhanced fixture's gray
range changed from 49 to 201; no readability percentage is inferred from that.

## Evidence handling

`src/config/scanner-benchmark.ts` projects an allowlisted summary from the
retained report. It uses fixed case denominators and checks individual HTTP,
page, pixel, source and render records. Missing, duplicate, failed, wrong-phase
or generate-only evidence cannot be represented as a clean pass. A failing
case remains visible with an explicit status. Aggregate summary pass flags
are not trusted.

The visible section and Dataset use the same sanitized values. Raw reports,
local paths, response hashes, source-image filenames and private operator
notes are not sent as public data. Each case describes the check performed;
the status and counters show its measured result.

## Verification record

Reports are retained in `quality/phase3-scanner-publication/`. Final check
counts, source hashes and build/browser observations are recorded there.

- 45/45 focused unit and regression checks passed.
- Eight offline HTTP-parser self-tests passed.
- Touched-file ESLint passed, and the final webpack build generated 170/170 entries.
- 21/21 read-only HTTP publication checks passed against the production build
  on loopback port 3002, including historical datasets and private-field exclusion.
- Browser review on the restored port-3001 development preview passed at
  390x844, 768x1024 and 1280x900, without horizontal overflow. The Scanner
  return link and guide link worked; the inspected console had no warnings
  or errors. Screenshots were inspected inline, not archived as files.
- The normal offline preview was restored and both `/benchmarks` and
  `/pdf-scanner` returned HTTP 200 with the new section/link.

The data tests exercise missing and duplicate evidence, wrong response/filter
values, page order, source and render completeness, B&W and Enhanced checks,
error responses, deterministic dates and public-field privacy. Component tests
cover separate counters, matching Dataset data, links and failure states.

The first focused data-test attempt reported an environment out-of-memory
error while cloning a small fixture. The same suite passed 21/21 with a
single-worker memory-bounded run and no test or implementation change.
Verification uses bounded test workers. The development preview is temporarily
stopped during the final build to avoid the host-memory failure seen in 3.4.

The first production build compiled but found TypeScript errors in test fixture
union access and optional component-prop inference. Explicit field narrowing
and a normal typed component parameter corrected those errors without changing
the published measurements or conversion behavior. The initial build log is
retained separately from the final result. The build still reports existing
custom cache-header, middleware-convention and legacy Buffer warnings.

The initial browser attachment timed out. After the interrupted task was
resumed, the preview process was restarted and all browser checks above were
completed successfully. The temporary port-3002 server was stopped. This
publication task did not repeat Phase 3.4 conversion measurements.

## Boundaries

This publishes existing controlled evidence; it does not rerun or modify
conversion engines. Static synthetic JPG, PNG and WebP fixtures do not certify
physical cameras, arbitrary documents, OCR, handwriting, animation, automatic
crop, perspective correction or ten maximum-size images. Local test results
do not establish production speed, load capacity, cost or customer acceptance.

No Hindi page, Hindi translation, credential, cloud setting, paid service or
public deployment was changed. The deferred Phase 2 public launch gates remain
open. Phase 3.4's saved-file gate is closed by explicit user confirmation, with
its automation limitation and independent HTTP artifact checks kept separate.
