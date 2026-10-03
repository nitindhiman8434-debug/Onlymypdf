# Phase 3.2A: local language and document corpus

**Date:** 3 October 2026

**Status:** Diagnostic and local publication complete; four conversion checks remain failing.

**Scope:** A reproducible diagnostic and benchmark report; no conversion engine or routing changes.

This task expands the Phase 3.1 two-page baseline with six synthetic selectable-text
PDFs and eighteen actual local HTTP conversions. It measures selected content and
specified spreadsheet values. It does not certify whole-document correctness.
Phase 2's deferred production and real-customer gates remain open.

## What was added

- Hindi memo, Hindi/English invoice, French invoice, German invoice, three-page
  mixed-orientation report, and two-page dense article fixtures.
- Offline generation with local fonts and a source-text gate before scoring a
  conversion. All nine source pages were visually reviewed in the contact sheet.
- MIME, Office ZIP CRC and required XML checks, source/output hashes, durations,
  selected Unicode marker counts, and accidental Excel formula detection.
- Word editable-document checks and PowerPoint editable-slide checks. Speaker
  notes cannot stand in for on-slide text.
- Excel primary and recovery text evaluated separately. Page-number metadata in
  recovery sheets is excluded; intentional backup copies do not count as data
  duplication. Specified primary-cell expectations cannot pass through recovery
  text alone.
- A server-rendered report on `/benchmarks#document-corpus`, with pass, fail,
  transport error and unverified results separated. Missing/duplicate evidence
  never becomes an automatic pass.

The committed measurement is
`quality/phase3-document-corpus/latest-report.json`. Raw PDFs, Office artifacts and
previews remain under ignored `tmp/pdfs/phase3.2/`. No real user files were used.

## Final local measurement

All six source fixtures passed. All eighteen conversions returned HTTP 200 with
the expected MIME and valid Office package structure. Four artifacts failed the
selected content or typed-cell expectations; none was a transport/server error.

| Tool | Passed | Failed |
| --- | ---: | ---: |
| Word | 5 | 1 |
| Excel | 3 | 3 |
| PowerPoint | 6 | 0 |
| Total | 14 | 4 |

This is a check count, not a conversion accuracy percentage. The runner correctly
returned exit code 1. The unchanged Phase 3.1 baseline is still a separate report.

## Confirmed findings for the next task

1. **French spreadsheet number parsing:** the source amount `12,50` in the
   `Crème brûlée` row becomes numeric `1250` in the primary table. The original
   spelling in the recovery sheet does not repair the wrong primary amount.
2. **German spreadsheet identifier typing:** primary `Artikelkennung` value
   `001234` becomes numeric `1234`. Identifiers need a literal string contract.
3. **Hindi editable Word text:** the memo's `कुल राशि` loses its final vowel sign
   in editable DOCX text (`कुलराश`). A readable source image would not establish
   editable-text preservation.
4. **Hindi spreadsheet extraction:** the memo loses prose, reorders identifier
   punctuation and Hindi characters, and has no `Source text` recovery sheet.

The Hindi DOCX and PPTX were also opened through LibreOffice's PDF export and
visually inspected. Both rendered one page. The DOCX visibly loses word spacing
and the final vowel sign. The PPTX preserves selected text but shows Hindi shaping
artifacts, so a content pass must not be treated as a visual pass. This spot check
does not establish Microsoft Office rendering or fidelity for the other files.

Additional inspected limitations remain outside the selected pass criteria:
some bilingual table labels have reordered characters; mixed-page table labels
can reorder underscores; a two-column article is fragmented into tables while
its content remains in recovery. A passing selected-content check therefore
does not prove correct primary table placement or reading order.

The initial validator flattened every worksheet cell together. That incorrectly
counted recovery copies twice and inserted recovery page numbers into split
words. Artifact inspection identified this measurement error. The revised
validator separates these representations and adds primary-cell assertions so
backup content cannot conceal the numeric and identifier defects.

## Reproduce locally

```powershell
npm run dev:local-preview
# In another terminal:
npm run phase3.2:validator-tests
npm run phase3.2:document-corpus
```

The full corpus returns exit code 1 while any quality expectation is unmet; the
JSON report is still written. This is a diagnostic, not a passing release gate.
For generation-only or focused checks, see the corpus README. Python needs
PyMuPDF, Pillow and fontTools; no new paid service or downloaded font is needed.
The HTTP runner accepts only loopback origins and rejects remote redirects.

## Boundaries and next gate

Hindi fixtures use simple words because the local PDF generator's Unicode map
was unreliable for some complex conjuncts. Source failures were detected before
conversion and were not scored against the app. Complex conjuncts, other script
families, real OCR recognition, handwriting, accessibility semantics and full
layout fidelity need separate coverage. Tesseract is absent on this machine.

The next bounded task is **Phase 3.2B: repair primary spreadsheet amount and
identifier handling**, then rerun both these cases and the existing Excel corpus.
Hindi text extraction needs its own targeted regression work after that. These
are conversion-output changes and should be carried out as explicitly scoped
follow-up work, not hidden inside the benchmark publication change.

Global deployment, production capacity/cost and customer feedback are still
separate gates under the user's no-paid-plan decision.

## Implementation exit checks

- Python validator behavior: 12/12 tests passed, including recovery metadata,
  duplicate content, formula literals, numeric typing and identifier loss.
- Public report/baseline contracts: 6/6 Vitest tests passed.
- Touched-file ESLint passed. Production build and its TypeScript check passed;
  Next.js generated 169/169 pages. Existing Next.js middleware/Edge runtime,
  cache and Buffer deprecation warnings remain non-blocking.
- Browser review at 514 pixels showed all six corpus cards, 14/18 passing,
  four needing improvement, zero transport errors, no horizontal overflow and
  no console warnings/errors. A screenshot is saved at
  `tmp/pdfs/phase3.2/benchmark-browser.jpg`.
- All eighteen artifacts had matching MIME types and valid package structure;
  no unexpected Excel formulas were present. Word used local `pdf2docx`.

This closes the diagnostic implementation only. Four content/typed-cell checks
and the inspected visual defects are deliberately left visible for remediation.
