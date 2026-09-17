# Phase 1 Dependable Beta — Implementation Checkpoint

**Date:** 17 September 2026

**Branch:** `phase1-dependable-beta`

**Starting product readiness:** 70/100

**Current evidence-based readiness:** 78/100
**Phase 1 target after live activation:** 82/100

## Decision

The Phase 1 application code and local verification package are complete. Phase 2 must not start yet. Phase 1 remains at **83%** until migration 021, Supabase private storage, Upstash, the dedicated worker, scheduled cleanup, detailed health monitoring, and the 25/200 MB path are verified in the target production environment.

The remaining work needs production account configuration that is not present in `.env.local`. Local values currently exist for `CRON_SECRET`, `PDF2DOCX_PYTHON`, and `LIBREOFFICE_PATH`; Supabase, Upstash, `HEALTH_CHECK_SECRET`, and ConvertAPI are not configured.

## Issues found and resolved

1. **Background work could disappear after an API restart.** PDF-to-Word jobs now enter a persistent Upstash FIFO queue, stage decrypted input in private Supabase storage, move through queued/running/done/error states, and can be processed by a separate worker.
2. **No worker crash recovery.** Claimed job IDs move to a processing list. A 15-minute lease recovery path requeues stale work. A separate worker command, authenticated recovery endpoint, and resource-limited Docker worker are included.
3. **A non-empty file could be marked complete even when corrupt.** PDF, DOCX, XLSX, PPTX, TXT, HTML, and image outputs now pass format-aware signature and openability checks. Office packages must contain their required Open XML parts; PDFs must open and contain pages.
4. **First direct guest job could fail polling with Access denied.** Middleware now forwards the newly generated guest-session cookie into the same request, so the job owner used at creation matches status and download requests.
5. **Conversion success, engine, fallback, queue time, and validity were not measurable.** Migration 021 and the telemetry service record these fields. Authenticated health diagnostics now expose 24-hour success, validity, fallback, queue, latency, and cleanup evidence.
6. **Crashed staged inputs could remain after their Redis job expired.** Hourly cleanup now scans `temp-jobs/pdf-to-word`, removes objects older than two hours, records deleted/failed counts, and makes failures health-check visible.
7. **Signed URLs could outlive a file's remaining retention window.** Signed download lifetime is now capped by both two hours and the database `expires_at` deadline. The `pdf-files` bucket is forced private by migration 021.
8. **An upload could declare one size and return a different body length.** Upload validation now rejects the mismatch. Exact 25 MB and 200 MB boundaries and a concurrent 25/50/100/200 MB validation batch pass.
9. **Core output fidelity had no declared corpus.** A deterministic 200-document corpus now covers text, tables, image-only scans, Hindi image text, mixed orientation, forms, fonts, and larger multi-page documents.

## Verification evidence

| Gate | Result | Evidence |
|---|---:|---|
| Declared corpus | Pass | 200/200 jobs; 100% success against a 99.5% threshold |
| Extractable text fidelity | Pass | 155/155 applicable output checks |
| Rendered visual fidelity | Pass | 40/40 comparisons; minimum similarity 97.99% |
| Simple-job latency | Pass | Corpus p95 309 ms, below 15 seconds |
| Office engine evidence | Pass | 7/7 PDF↔Word/Excel/PowerPoint jobs opened successfully |
| PDF→Word | Pass | Word COM, 14.353 s, valid DOCX with 1,330 extracted characters |
| PDF→Excel | Pass | 2.126 s, valid workbook with two worksheets |
| PDF→PowerPoint text | Pass | 3.617 s, two slides, 1,330 extractable characters, two editable slides reported by engine |
| PDF→PowerPoint scan | Pass with declared limit | 3.353 s, valid two-slide image presentation; no extractable text expected for image-only source |
| Office→PDF | Pass | Word 3.313 s, Excel 3.678 s, PowerPoint 5.989 s; all valid PDFs |
| Durable localhost job | Pass | queued → done; 29 ms queue, 4.562 s processing, `pdf2docx`, output valid |
| Protected download | Pass | First download 200 with 36,970-byte DOCX; repeated consume returned 404 |
| Upload boundaries | Pass | Exact 25 MB and 200 MB accepted; one-byte-over rejected; concurrent 25/50/100/200 MB accepted by application validator |
| Targeted Phase 1 tests | Pass | 40/40 |
| Full regression | Pass | 594/594 across 119 files |
| TypeScript | Pass | `tsc --noEmit` |
| ESLint | Pass | Zero errors; 18 existing warnings |
| Production build | Pass | 153/153 static pages and `/api/cron/conversion-worker` generated |
| Production dependency audit | Pass | Zero moderate, high, or critical production vulnerabilities |

Evidence files:

- `quality/phase1-corpus/manifest.json`
- `quality/phase1-corpus/latest-report.json`
- `quality/phase1-corpus/engine-report.json`
- `quality/phase1-corpus/upload-boundary-report.json`
- `supabase/migrations/021_phase1_conversion_operations.sql`

## Phase 1 workstream status

| Workstream | Weight | Complete | Status |
|---|---:|---:|---|
| 200-document quality corpus | 20% | 20% | Local gate passed |
| Output validation and fidelity evidence | 15% | 15% | Local gate passed |
| Engine routing and fallback evidence | 10% | 10% | Local gate passed |
| Queue, worker, retry, and crash recovery | 20% | 16% | Code/local passed; production worker deployment pending |
| Private storage and deletion evidence | 15% | 10% | Code passed; live 2h/24h observation pending |
| 25/200 MB load path | 10% | 5% | Application boundary passed; CDN/storage/worker proof pending |
| Monitoring and alerting | 10% | 7% | Health signals implemented; external monitor and live history pending |
| **Total** | **100%** | **83%** | **Do not start Phase 2** |

## Required live activation gate

1. Configure Supabase and Upstash secrets and apply migrations 001–021.
2. Deploy `Dockerfile.worker` or run `npm run worker:conversions` on an isolated worker host.
3. Run authenticated `/api/health` and confirm queue, validity, latency, and cleanup checks are healthy.
4. Observe at least one successful cleanup cycle and one controlled failed-object retry; verify no staged object survives beyond its retention window.
5. Send real 25 MB Free and 200 MB Pro files through CDN/proxy → app → queue → worker → private storage → download.
6. Attach an external alert to detailed health degradation and a worker/container restart alert.

After these six checks pass, Phase 1 can be marked 100% and readiness can move from 78 to 82. Only then should Phase 2 begin.
