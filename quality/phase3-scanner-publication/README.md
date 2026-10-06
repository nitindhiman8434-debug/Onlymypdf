# Phase 3.5 Scanner evidence publication

This directory records publication checks for `/benchmarks#scanner-results`.
Conversion measurements remain in `quality/phase3-scanner/first-report.json`;
this task does not produce new conversion-performance or accuracy results.

- `unit-report.json`: 45 passing focused data, component, guide and SEO checks.
- `http-report.json`: 21 passing read-only checks of actual HTML, streamed content,
  Dataset agreement, historical evidence, links and private-field exclusion.
- `verification-report.json`: final build, browser observations and source hashes.

The browser review is separate from static HTML checks. Public counters keep
5 successful conversion cases, 6 invalid-input checks and 14 rendered PDF pages
distinct. The underlying measurements retain 6 October 2026 UTC as their date.

## Reproduce

```powershell
node scripts/phase3-scanner-publication-check.mjs --self-test
# Serve the production build on loopback port 3002 with offline credentials.
node scripts/phase3-scanner-publication-check.mjs
```

`SCANNER_BENCHMARK_BASE_URL` may select another loopback HTTP origin. The checker
rejects external origins and redirects, never executes response scripts and
does not submit files. Eight offline parser checks cover direct and genuine
streamed markup, missing segments, quoted/function/comment/RSC spoofing and
non-hidden transfer sources. Duplicate and cyclic guards also exist, but are
not part of these eight self-tests.

The final webpack build passed with 170/170 generated entries. The browser
review used the restored local development preview on port 3001 at 390, 768
and 1280 pixels; no horizontal overflow was found. Scanner and guide navigation
passed, and no browser console warnings or errors were recorded. Screenshots
were reviewed inline in the task; screenshot files were not archived.

No real-camera certification, user-file inspection, cloud deployment, public
indexing, production capacity or universal accuracy claim is established here.
