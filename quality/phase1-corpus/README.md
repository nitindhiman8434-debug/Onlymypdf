# Phase 1 declared quality corpus

`npm run phase1:corpus` deterministically generates and executes 200 conversion
jobs. The cases cover text documents, tables, image-only scans, Hindi image text,
mixed page orientation, form fields, font variation, and larger multi-page shapes.

The runner uses the same service functions as the website for merge, split,
extract, delete, rotate, and basic compression. Every output must:

- have a valid PDF signature and open successfully;
- preserve the operation's expected page count; and
- finish without an engine exception.

Generated input PDFs stay out of Git. `manifest.json` and `latest-report.json`
are reviewable evidence. This corpus proves deterministic PDF operations. Office
layout fidelity, OCR accuracy, and production 25/200 MB load evidence are separate
Phase 1 gates and are not implied by this run.
