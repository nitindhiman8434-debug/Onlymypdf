# Phase 3.2H local publication evidence

This gate publishes retained English OCR evidence without changing conversion
code or creating new conversion measurements.

- `unit-report.json`: 52 focused Vitest checks passed, including report mutations,
  dates, visual-report bindings, server rendering, JSON-LD and existing SEO checks.
- `http-report.json`: 11/11 checks passed against the built application on a
  temporary loopback-only port. The temporary server was stopped after the check.
- `dev-http-report.json`: earlier development response, 10/11. The strict
  machine-path gate detected Next.js development stack traces. The same unchanged
  check passed against the built response; this is not a hidden data-contract fix.
- `visual-review.json`: browser review at mobile, tablet and desktop widths.
- `verification-report.json`: final build/lint/test results and source hashes.

The four dated fixture outcomes remain 4/4, 5/5, 4/4 and 4/4. Controls are
included in those denominators. Do not sum regression re-runs as new documents
or translate pass counts into a universal accuracy percentage.

For the detailed implementation and boundaries, see
`docs/PHASE_3_2H_ENGLISH_OCR_BENCHMARKS.md`.
