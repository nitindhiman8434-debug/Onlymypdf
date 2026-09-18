# Phase 2.3 PDF to Word quality evidence

`latest-report.json` is produced by the deterministic image-only PDF benchmark:

```bash
npm run phase2.3:ocr-benchmark
```

The benchmark builds a raster-only PDF at runtime, converts it through the production Python pipeline, opens the DOCX package and verifies editable text, expected-token recall, output size and media count. Generated source and output files stay in a temporary directory.

The initial gate covers clean printed English at 220 DPI. It does not claim handwriting, damaged scans, every language, or arbitrary layout is accurate.
