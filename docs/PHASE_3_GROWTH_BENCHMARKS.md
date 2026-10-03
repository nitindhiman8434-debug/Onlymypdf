# Phase 3.1: evidence-based benchmark publishing

**Started:** 3 October 2026  
**Status:** Tasks 3.1, 3.2A and scoped 3.2B complete locally

Phase 2 remains 90% complete. Its public HTTPS/load/retention/cost gate is deferred under the user's no-paid-plan decision, and its real-customer evidence cannot be manufactured locally. Those external launch gates remain open and are not counted as complete. This explicit deferral allows no-cost Phase 3 preparation to continue without misrepresenting Phase 2 as finished.

## Task 3.1 scope

The first Phase 3 roadmap item is to publish benchmark reports and unique educational content. The initial `/benchmarks` report uses the 3 October local release revalidation and:

- reports PDF-to-Word, PDF-to-Excel, and PDF-to-PowerPoint artifact results;
- states the fixture, environment, output bytes, editable-text check, and page-completeness result;
- separates controlled local evidence from production latency, capacity, uptime, cost, and universal-accuracy claims;
- adds Dataset, Breadcrumb, and FAQ structured data;
- adds sitemap, footer and `llms.txt` discovery (the initial Hindi variant was
  retired by the English-only decision in Task 3.2B).

## Exit checks

- Benchmark data contract, SEO route, and sitemap tests passed: 4/4.
- TypeScript and touched-file ESLint passed with zero errors.
- Next.js 16.3.6 production build passed and generated 169/169 pages, including `/benchmarks`.
- At Task 3.1 completion the sitemap contained both `/benchmarks` and
  `/hi/benchmarks`; Task 3.2B retains only the English URL and redirects the old
  Hindi URL. `llms.txt` contains the report link.
- Browser review at a 514-pixel viewport found no horizontal overflow, all three result cards, valid Dataset/Breadcrumb/FAQ JSON-LD, and zero console warnings or errors.

The report is ready in the local application. Publishing it on the public Internet remains part of the deferred production deployment decision.

## Task 3.2A: expanded language and document evidence

The diagnostic completed locally: six synthetic PDFs across
eighteen HTTP Office conversions, with 14 checks passing and four failing.
The expanded results appear on `/benchmarks#document-corpus`; see
[the detailed findings and follow-up gate](PHASE_3_2_MULTILINGUAL_CORPUS.md).
This baseline did not close conversion quality or Phase 2 production gates.

## Task 3.2B: English website and targeted conversion fixes

The website now exposes English only; old Hindi page URLs redirect to their
English equivalents. Hindi document input remains supported and tested.
Spreadsheet amount/identifier typing and Hindi Office text/shaping regressions
were fixed. The unchanged expanded corpus passes **18/18**, with the existing
Excel 7/7 and rendered PowerPoint 8/8 corpora still passing. The full automated
suite passes 722/722 and the production build succeeds. See
[implementation and validation evidence](PHASE_3_2B_ENGLISH_SITE_AND_CONVERSION_FIXES.md).

Next is broader script/conjunct and actual OCR evidence, followed by real-customer
feedback and the separately deferred production launch gates. Selected fixture
passes do not establish universal accuracy or production capacity. No paid
deployment was made for this task.
