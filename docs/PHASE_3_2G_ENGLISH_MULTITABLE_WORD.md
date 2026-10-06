# Phase 3.2G: two English scanned tables on one Word page

**Date:** 7 October 2026

**Status:** Scoped implementation and local artifact verification complete. Public deployment remains deferred.

## Scope and observed problem

The previous ruled-table fallback intentionally rejected a second table on the
same page. In the frozen new corpus, three two-table invoices failed while a
borderless two-group memo passed. The invoices returned paragraph transcripts
instead of two native Word tables; vertical rules also confused header recognition.

This task supports at most two clean, vertically separated, completely ruled
rectangular tables per scanned page in the existing Latin OCR fallback. Complete
prose before, between and after the tables must retain its order, spacing and
repetitions. Existing successful primary conversion, non-Latin routing, OCR
languages, paid/cloud settings and website pages are outside this change.

## Implementation contract

- Both grids must be valid and vertically separated. A malformed second or
  third grid, side-by-side tables, nested/overlapping geometry or ambiguous word
  membership rejects the entire page layout rather than returning a partial table.
- Reuse the existing fallback OCR invocation for both TXT and TSV. Optional
  border preparation retains the original source pixmap for geometric analysis.
  The thin black/gray punctuation guards from 3.2F remain in force for each grid.
- Ordered paragraph/table blocks preserve the complete recognized token inventory.
  Only table word ordering is reconstructed from geometry. Surrounding and
  intervening paragraphs come from their exact raw transcript spans.
- The Word writer validates every block and both matrices before creating an
  output document. Missing/duplicated tokens, changed amounts, malformed column
  widths and empty/unknown blocks cannot silently discard content.
- Tables have independent relative column widths. Separate source-page sections
  retain portrait/landscape dimensions. Consecutive tables receive an empty Word
  paragraph separator when no prose separates them, preventing accidental merging.

## Verification evidence

The four fixed synthetic inputs contain two portrait examples (including wrapped
descriptions), one landscape example and a negative borderless memo. Sources were
independently validated as literal DOCX, rendered PDF and image-only scans before
conversion. Expected full text, exact native matrices, identifiers, amounts,
repeated headers and paragraph positions are frozen before the baseline.

Reports reside under `quality/phase3-english-multitable/`; generated PDFs, DOCX
and PNGs stay under ignored `tmp/pdfs/phase3.2g-english-multitable/`. Baseline and
subsequent run files are never overwritten.

| Check | Result and evidence |
| --- | --- |
| Frozen baseline | 1/4 passed; all three two-table invoices failed (`baseline-report.json`) |
| Intermediate implementation | 2/4 passed (`after-report.json`) |
| Final real HTTP conversions | 4/4 passed; three exact two-table outputs and the zero-table control (`final-report.json`) |
| Existing one-table / multi-page table corpus | 4/4 passed (`single-table-regression-report.json`) |
| Existing selectable / scanned English Word corpus | 4/4 passed (`word-regression-report.json`) |
| Unreadable and mixed readable/unreadable scans | 2/2 returned HTTP 422 with no false output artifact (`rejection-report.json`) |
| Focused automated tests | 139/139 passed across six suites (`unit-report.json`) |
| Independent rendered output review | All four pages passed; exact paragraph/table order also checked directly in Word XML (`visual-review.json`) |

The intermediate failures exposed two conservative detection edges: faint pixels
next to a rule intersection blocked preparation of the portrait page, and a text
glyph looked like a third candidate grid on the landscape page. The fix preserves
unexplained intersection pixels instead of erasing them and requires substantial
horizontal and vertical rule evidence for a grid candidate. The frozen source
documents, exact text, amounts and expected table matrices were not weakened.

The 139 tests comprise 49 geometry/preparation tests, eight Word-writer tests,
22 English fallback tests and 60 strict corpus-validator tests. They include
partial/merged second-grid rejection, punctuation preservation, exact intervening
paragraphs, different table widths, empty-cell handling and malformed output
metadata. An independent review additionally checked 120 junction-punctuation
variants: accepted cases preserved the tested pixels; unsupported cases declined
preparation without changing the source.

All final DOCX files are valid editable ZIP/XML artifacts, retain complete literal
matrices and paragraphs, and render to their expected one-page portrait or
landscape dimensions. Visual inspection found no missing content, clipping or
overlap. Source heading weight, row heights, wrapping and paragraph spacing are
not reproduced exactly; the landscape separating prose is tighter but readable.
The negative memo keeps its words as paragraphs, not its original tab alignment.
This was agent visual review, not customer acceptance or human sign-off.

The existing last-page regression also passed: three pages in the single path,
two selected pages in each chunk path and three pages in the OCR conversion
branch. That last branch substitutes recognition with a prepared searchable PDF;
it verifies page selection, not OCR quality. Actual OCR is exercised by the HTTP
corpora above. The GitHub English quality workflow now includes the new validator
suite; remote workflow status is separate from these recorded local results.

## Reproduce

Start `npm run dev:local-preview`, then use fresh source/run labels:

```powershell
npm run phase3.2g:validator-tests
npm run phase3.2f:table-tests
npm run phase3.2d:layout-tests
python scripts/phase3-english-multitable-corpus.py --generate-only --run-label fresh-sources
python scripts/phase3-english-multitable-corpus.py --run-label recheck --reuse-sources quality/phase3-english-multitable/fresh-sources-report.json
```

The runner only accepts loopback HTTP and verifies frozen definitions, helper
hashes and source files when reusing them. Inspect every independently rendered
output PNG in addition to the automated ZIP/XML, exact text, table, page count
and page dimension checks.

## Boundaries

Each table remains limited to 2–8 columns and 2–40 rows; the HTTP corpus covers
two four-column header-plus-three-row tables per page. This does not establish
merged-cell, borderless-table, side-by-side, skewed, damaged-grid or three-table
support. It does not reconstruct embedded illustrations or guarantee source
typography, arbitrary OCR accuracy, production throughput or global availability.
Hindi pages remain untouched. Real-customer evidence and deferred public launch
gates are separate from this controlled local verification.
