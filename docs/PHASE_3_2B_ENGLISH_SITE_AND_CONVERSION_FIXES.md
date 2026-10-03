# Phase 3.2B: English website and conversion remediation

**Date:** 3 October 2026

**Status:** Complete for the scoped English-only website and identified local
conversion regressions. Production and broader accuracy gates remain open.

The user requested an English-only website and completion of the conversion
issues found in Phase 3.2A. Website language and document language are separate:
the public interface uses English while Hindi PDFs remain part of conversion
testing. Existing Hindi dictionaries are retained for a reversible future
decision; they are not advertised as active website pages.

## Acceptance checks

- No public Hindi language switch, Hindi sitemap URLs or Hindi SEO alternates.
- Legacy `/hi` pages redirect to their English counterpart with query strings
  preserved. Existing language cookies or saved preferences cannot restore a
  Hindi interface. Normal API routes keep their existing behavior.
- French invoice amount `12,50` is numeric `12.5` in the primary worksheet.
- German identifier `001234` remains a literal string including its zeros.
- Hindi memo prose, identifiers and vowel signs survive Excel extraction.
- Hindi Word retains the full editable phrase `कुल राशि` and meaningful word
  spacing. PowerPoint complex-script text is checked by rendering as well as XML.
- Existing English numeric, formula safety, page-completeness and Office corpus
  regressions continue to pass. The Phase 3.2A validator expectations stay intact.

## Evidence and limits

Before remediation, the eighteen-case local conversion report had fourteen
passing and four failing results. A recovery worksheet preserved some source
text but could not repair incorrect values in the primary table. The diagnostic
therefore checks typed primary cells independently of recovered text.

The measurement source remains
`quality/phase3-document-corpus/latest-report.json`. Raw synthetic fixtures and
outputs stay in `tmp/pdfs/phase3.2/`; earlier artifacts are reproducible from Git.
This is local evidence on controlled documents. Complex conjunct coverage,
arbitrary document accuracy, actual local OCR recognition, real-customer
feedback, global deployment and production capacity/cost are separate gates.
No public deployment or paid-plan purchase is part of this task.

## Implemented fixes

- English is the only active website language. Desktop/mobile switches, Hindi
  sitemap entries and Hindi SEO alternates were removed. The middleware redirects
  old `/hi` page URLs with HTTP 308, preserves unrelated query parameters and
  clears the retired locale cookie. `/hi/api/*` returns 404 instead of aliasing
  API routes. Persisted Hindi settings cannot change the interface language.
- Spreadsheet extraction preserves raw cell text until semantic typing. French
  decimals become numbers while leading-zero identifiers, long identifiers and
  formula-like strings retain their literal content. Ambiguous separators are
  not guessed without supporting table evidence.
- Hindi extraction repairs combining-mark/source-order fragments and preserves
  missing prose in a separate recovery sheet. Ordinary Latin/numeric cells keep
  geometric order, including a regression fixture painted in reverse order.
- Word and PowerPoint join compatible Hindi fragments into editable text runs,
  preserve spaces and use complex-script font metadata. Word table widths are
  synchronized only for consistent, unmerged grids. Hindi and bilingual outputs
  were rendered locally for visual inspection.
- CI corpus workflows now include the new Python and spreadsheet parser tests;
  the PowerPoint Linux job installs the Noto font family used by these outputs.

## Final measured results

The unchanged eighteen-case validator now reports **18 passed, 0 failed, 0
transport errors**: Word 6/6, Excel 6/6 and PowerPoint 6/6. All six source
fixtures passed their source-content checks. Every response was HTTP 200 with
the expected MIME type and valid Office package structure. No unexpected Excel
formulas were present. The report was rerun after the reverse-painting regression
fix, rather than relying on an earlier passing snapshot.

The French invoice's primary `Table 1!B2` is numeric `12.5`; the German invoice's
primary `Table 1!B2` is the string `001234`. The four Phase 3.2A failures are
resolved in this controlled corpus. Hindi Word and PowerPoint spot-check renders
show readable vowel signs, word spacing and table content; this is not a claim
about every Hindi font, conjunct or Office renderer.

| Validation | Result |
| --- | --- |
| Full TypeScript/Vitest suite | 722/722 tests, 138 files |
| Excel extractor Python regression tests | 14/14 |
| Hindi Office Python regression tests | 13/13 |
| Corpus validator Python tests | 12/12 |
| Existing Excel corpus | 7/7 |
| Existing PowerPoint rendered corpus | 8/8 |
| Word last-page checks | Single 3/3; in-process chunk 2/2; subprocess 2/2; searchable-OCR stub 3/3 |
| ESLint and whitespace checks | Passed for touched source files |
| Workflow YAML parsing | All three edited workflows passed |
| Production build and TypeScript | Passed; 169/169 pages generated |
| Browser and HTTP | English UI, legacy redirects, sitemap and normal API health passed |

The build retains non-blocking framework middleware/Edge-runtime, webpack-cache
and Buffer deprecation warnings. The browser had no console warnings/errors or
horizontal overflow at the inspected narrow viewport. The mobile menu and
homepage were checked after removing the language controls. Browser evidence is
under `tmp/pdfs/phase3.2/english-only-home.jpg`; conversion renders are in the
`word-fixed-render` and `ppt-fixed-render` subdirectories.
The final browser report also shows 18/18 with no console warnings/errors;
its screenshot is `tmp/pdfs/phase3.2/benchmark-browser-final.jpg`.

## Remaining project gates

This closes this remediation task, not the entire product roadmap. The next
bounded quality task is broader script/conjunct and real OCR coverage with
independently verified source fixtures. Real-customer feedback, Microsoft Office
rendering, live Linux CI results, public HTTPS deployment, retention verification,
capacity and production cost remain separate evidence. The local OCR stub checks
the route through the code; it does not substitute for actual OCR recognition.
