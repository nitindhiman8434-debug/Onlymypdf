# Phase 2.3 PDF to Word quality evidence

`latest-report.json` is produced by the deterministic image-only PDF benchmark:

```bash
npm run phase2.3:ocr-benchmark
```

The benchmark builds a raster-only PDF at runtime, converts it through the production Python pipeline, opens the DOCX package and verifies editable text, expected-token recall, output size and media count. Generated source and output files stay in a temporary directory.

The initial gate covers clean printed English at 220 DPI. It does not claim handwriting, damaged scans, every language, or arbitrary layout is accurate.

`latest-corpus-report.json` is produced by the Phase 2.3B Hindi, mixed-language and difficult-scan corpus:

```bash
npm run phase2.3b:ocr-corpus
```

That gate covers clean printed Hindi, mixed English/Hindi, 2.4-degree skew, low-resolution input, two-column content, a bilingual table/form, a deliberately damaged scan, and an unreadable scan that must fail closed. Successful cases must produce a valid DOCX, a visual source reference, visible editable text, a rendered Word preview and the case-specific minimum token recall. The unreadable case must return no valid DOCX.

The corpus is a controlled regression set. It does not promise universal OCR accuracy, handwriting support, or correct recognition for every language, font, scan and layout.
