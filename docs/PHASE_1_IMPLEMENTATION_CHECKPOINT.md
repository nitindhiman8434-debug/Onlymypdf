# Phase 1 Dependable Beta Implementation Checkpoint

**Date:** 18 September 2026

**Branch:** `phase1-dependable-beta`

**Starting product readiness:** 70/100

**Current evidence-based readiness:** 82/100
**Phase 1 completion:** 100%

## Decision

Phase 1 is **100% complete against its defined Dependable Beta acceptance gate**. Phase 2 is eligible to start.

The live system now has Supabase database controls, Upstash queueing, private Cloudflare R2 storage, a persistent Railway conversion worker, an independent five-minute Railway watchdog, hourly two-hour-retention cleanup, a verified failed-deletion retry, and end-to-end 25 MB and exact 200 MB PDF-to-Word paths. The 200 MB job produced a signature-valid, openable DOCX and left no R2 objects behind. A controlled watchdog failure exited non-zero and produced a real Railway in-app deployment-crashed notification; the failure flag was then disabled and the service was restored to healthy mode.

This phase result does not mean every possible PDF will convert with identical layout or speed. Paid ConvertAPI fallback remains unconfigured, and the exact 200 MB fixture proves the transfer, queue, worker, validation, and cleanup path rather than a worst-case 200 MB document with complex content.

## Issues found and resolved

1. **Background work could disappear after an API restart.** PDF-to-Word jobs now enter a persistent Upstash FIFO queue, stage decrypted input in private object storage, move through queued/running/done/error states, and are processed by a separate worker.
2. **No worker crash recovery.** Claimed job IDs move to a processing list. A 15-minute lease recovery path requeues stale work. A separate worker command, authenticated recovery endpoint, and resource-limited Docker worker are included.
3. **A non-empty file could be marked complete even when corrupt.** PDF, DOCX, XLSX, PPTX, TXT, HTML, and image outputs now pass format-aware signature and openability checks. Office packages must contain their required Open XML parts; PDFs must open and contain pages.
4. **First direct guest job could fail polling with Access denied.** Middleware now forwards the newly generated guest-session cookie into the same request, so the job owner used at creation matches status and download requests.
5. **Conversion success, engine, fallback, queue time, and validity were not measurable.** Migration 021 and the telemetry service record these fields. Authenticated health diagnostics expose 24-hour success, validity, fallback, queue, latency, and cleanup evidence.
6. **Crashed staged inputs could remain after their Redis job expired.** The Railway worker runs cleanup on startup and hourly, scans `temp-jobs/pdf-to-word`, removes objects older than two hours, records deleted/failed counts, and makes failures health-check visible.
7. **Signed URLs could outlive a file's remaining retention window.** Signed download lifetime is capped by both two hours and the database `expires_at` deadline. Private R2 storage prevents public reads.
8. **An upload could declare one size and return a different body length.** Upload validation rejects the mismatch. Exact 25 MB and 200 MB boundaries and a concurrent 25/50/100/200 MB validation batch pass.
9. **Core output fidelity had no declared corpus.** A deterministic 200-document corpus covers text, tables, image-only scans, Hindi image text, mixed orientation, forms, fonts, and larger multi-page documents.
10. **Large PDF-to-Word files crossed the application request body.** Configured environments use an owner-bound, expiring signed upload so bytes travel browser to private storage instead of through the serverless app body.
11. **Queued PDF passwords could not safely cross app and worker instances.** Passwords use AES-256-GCM encryption at rest in the job payload and are removed when the job completes or fails.
12. **A deployed worker could be silently dead.** The worker writes an Upstash heartbeat every 15 seconds. The independent Railway watchdog checks heartbeat and queue state every five minutes and exits non-zero on degradation. A controlled failure produced a real in-app alert.
13. **Abandoned direct uploads used a deeper folder than cleanup scanned.** Cleanup traverses bounded, paginated staging directories and removes expired `uploads/{uuid}/input.pdf` objects.
14. **A distributed worker could mark a job done after output storage failed.** Production and Redis-backed jobs fail closed unless the validated DOCX is persisted to private storage.
15. **Cleanup cron referenced a missing `payments.updated_at` column.** Migration 022 adds the column and index, and each payment claim transition refreshes the timestamp. The authenticated cleanup route completed with zero failures.
16. **The PDF-only bucket MIME rule blocked DOCX output.** The private object-storage allowlist accepts PDF input and DOCX output. API, dedicated-worker, browser, and 200 MB conversions pass.

## Verification evidence

| Gate | Result | Evidence |
|---|---:|---|
| Declared corpus | Pass | 200/200 jobs; 100% success against a 99.5% threshold |
| Extractable text fidelity | Pass | 155/155 applicable output checks |
| Rendered visual fidelity | Pass | 40/40 comparisons; minimum similarity 97.99% |
| Simple-job latency | Pass | Corpus p95 309 ms, below 15 seconds |
| Office engine evidence | Pass | 7/7 PDF and Office conversions opened successfully |
| PDF to Word | Pass | Word COM, 14.353 s, valid DOCX with 1,330 extracted characters |
| PDF to Excel | Pass | 2.126 s, valid workbook with two worksheets |
| PDF to PowerPoint text | Pass | 3.617 s, two slides, 1,330 extractable characters, two editable slides reported by engine |
| PDF to PowerPoint scan | Pass with declared limit | 3.353 s, valid two-slide image presentation; no extractable text expected for image-only source |
| Office to PDF | Pass | Word 3.313 s, Excel 3.678 s, PowerPoint 5.989 s; all valid PDFs |
| Live localhost API job | Pass | 1,096,734-byte PDF to 66,511-byte DOCX; 1.423 s queue; 4.851 s processing; `pdf2docx` |
| Artifact validation | Pass | DOCX signature/openability valid; 19 ZIP entries; 1 page; 1,052 text characters |
| Protected download | Pass | First download returned the valid DOCX; repeated consume returned 404 |
| Live Supabase, Upstash, and R2 | Pass | Private storage; queue depth zero; fresh worker heartbeat; scoped storage credentials |
| Railway conversion worker | Pass | Persistent service Active; startup/hourly cleanup logged; live jobs completed |
| Exact 25 MB worker path | Pass | 26,214,400-byte PDF; 4.688 s queue; 2.573 s processing; valid DOCX |
| Exact 200 MB worker path | Pass | 209,715,200-byte R2 input; 20.630 s upload; 3.050 s queue; 8.963 s processing; valid 66,627-byte DOCX |
| 200 MB cleanup | Pass | Input and output removed; verified R2 prefix remaining count 0 and bytes 0 |
| Browser signed upload | Pass | `/api/uploads/pdf-to-word` 201; direct private upload; job 202; DOCX download 200 |
| Retention deletion retry | Pass | Controlled failure recorded deleted 0/failed 1; retry recorded deleted 1/failed 0; marker remaining 0 |
| Scheduled cleanup | Pass | Conversion worker runs cleanup on startup and hourly with production two-hour TTL |
| Independent watchdog | Pass | Railway cron every five minutes; healthy run logged heartbeat and queue pending 0/processing 0 |
| Alert delivery | Pass | Forced unhealthy run crashed as designed and Railway delivered an in-app Deployment crashed notification |
| Authenticated health | Pass | All critical checks healthy; queue pending 0 and processing 0 |
| Upload boundaries | Pass live | Exact 25 MB and exact 200 MB paths completed end to end using configured storage routes |
| Targeted reliability tests | Pass | 5/5 across the updated worker, cleanup, and operational health files |
| Full regression baseline | Pass | 605/605 across 124 files before the final infrastructure-only activation |
| TypeScript | Pass | `tsc --noEmit` after the final code changes |
| ESLint baseline | Pass | Zero errors; 18 existing warnings |
| Production build baseline | Pass | 154/154 static pages; direct-upload and worker routes generated |
| Production dependency audit | Pass | Zero moderate, high, or critical production vulnerabilities |

Evidence files:

- `quality/phase1-corpus/manifest.json`
- `quality/phase1-corpus/latest-report.json`
- `quality/phase1-corpus/engine-report.json`
- `quality/phase1-corpus/upload-boundary-report.json`
- `quality/phase1-corpus/local-api-smoke-report.json`
- `quality/phase1-corpus/live-200mb-report.json`
- `quality/phase1-corpus/retention-retry-report.json`
- `supabase/migrations/021_phase1_conversion_operations.sql`
- `supabase/migrations/022_payment_processing_updated_at.sql`
- `scripts/phase1-dedicated-worker-smoke.ts`
- `scripts/phase1-live-200mb.ts`
- `scripts/phase1-retention-retry-drill.ts`
- `workers/conversion-worker.ts`
- `workers/conversion-watchdog.ts`

## Phase 1 workstream status

| Workstream | Weight | Complete | Status |
|---|---:|---:|---|
| 200-document quality corpus | 20% | 20% | Gate passed |
| Output validation and fidelity evidence | 15% | 15% | Gate passed |
| Engine routing and fallback evidence | 10% | 10% | Gate passed for configured engines |
| Queue, worker, retry, and crash recovery | 20% | 20% | Persistent Railway worker and recovery controls verified |
| Private storage and deletion evidence | 15% | 15% | Private R2 and failed-deletion retry verified |
| 25/200 MB load path | 10% | 10% | Both exact-size paths passed end to end |
| Monitoring and alerting | 10% | 10% | Scheduled watchdog and real in-app crash alert verified |
| **Total** | **100%** | **100%** | **Phase 2 eligible** |

## Live activation gate

1. **Completed:** Supabase and Upstash are configured, migrations 001-022 are applied, and object storage is private.
2. **Completed:** The dedicated conversion worker is deployed on Railway from `Dockerfile.worker` and remains healthy through its Upstash heartbeat.
3. **Completed:** Authenticated `/api/health` reports healthy private storage, queue, worker, conversion, and cleanup checks.
4. **Completed:** Production cleanup uses a two-hour TTL, runs on worker startup and hourly, and a live R2 deletion-failure retry drill passed.
5. **Completed:** Exact 25 MB and 200 MB PDF-to-Word paths passed end to end; the 200 MB route used R2 and returned a valid, openable DOCX.
6. **Completed:** An independent Railway watchdog runs every five minutes. Healthy and forced-unhealthy executions were recorded, and the forced failure produced a real Railway in-app alert.

## Remaining product limits after Phase 1

- The tested corpus and live fixtures prove the declared gates. They do not prove identical layout for every real-world PDF.
- The exact 200 MB fixture is a valid PDF extended to the exact boundary with zero padding. It proves the large-file transport and processing path, but it is not a worst-case complex 200 MB content benchmark.
- Image-only PDF-to-PowerPoint output remains image-based unless OCR is added as a separate capability.
- Paid ConvertAPI fallback is still unconfigured and unverified. The configured local and open-source engines remain the active path.
- Railway delivered the controlled crash alert in-app. The account is configured for email and in-app crash notifications, but the mailbox delivery was not separately inspected.

Phase 1 is complete. Begin Phase 2 from this checkpoint while keeping these product limits explicit in planning and customer-facing claims.
