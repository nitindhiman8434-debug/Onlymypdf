# Phase 1 Dependable Beta — Implementation Checkpoint

**Date:** 18 September 2026

**Branch:** `phase1-dependable-beta`

**Starting product readiness:** 70/100

**Current evidence-based readiness:** 81/100
**Phase 1 target after live activation:** 82/100

## Decision

Phase 2 must not start yet. Phase 1 is **95% complete**. Supabase, Upstash, migrations 001–022, private storage, the queue, a dedicated local worker, authenticated health, an authenticated cleanup run, browser signed upload, and the exact 25 MB worker path are live verified.

The remaining 5% requires a persistent worker host with restart policy, a scheduled two-hour retention and failed-deletion drill, a storage plan or provider that accepts 200 MB, and external health and worker alerts. Supabase Free is fixed at 50 MB, so the 200 MB Pro path cannot pass on the current plan. ConvertAPI also remains unconfigured.

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
10. **Large PDF-to-Word files crossed the application request body.** Configured environments now use an owner-bound, expiring Supabase signed upload so 25/200 MB bytes travel browser → private storage instead of through the serverless app body.
11. **Queued PDF passwords could not safely cross app and worker instances.** Passwords now use AES-256-GCM encryption at rest in the job payload and are removed when the job completes or fails.
12. **Worker deployment could be configured but silently dead.** The isolated worker now writes an Upstash heartbeat every 15 seconds. Detailed health fails when the heartbeat is older than 60 seconds, storage is public, or inline production claiming is enabled.
13. **Abandoned direct uploads used a deeper folder than cleanup scanned.** Cleanup now traverses bounded, paginated staging directories and removes expired `uploads/{uuid}/input.pdf` objects.
14. **A distributed worker could mark a job done after output storage failed.** Production and Redis-backed jobs now fail closed unless the validated DOCX is persisted to private storage.
15. **Cleanup cron referenced a missing `payments.updated_at` column.** Migration 022 adds the column and index, and each payment claim transition now refreshes the timestamp. The authenticated cleanup route then completed with zero failures.
16. **The PDF-only bucket MIME rule blocked DOCX output.** The private bucket allowlist now accepts PDF input and DOCX output. API, dedicated-worker, and browser conversions pass.

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
| Live localhost API job | Pass | 1,096,734-byte PDF → 66,511-byte DOCX; 1.423 s queue; 4.851 s processing; `pdf2docx` |
| Artifact validation | Pass | DOCX signature/openability valid; 19 ZIP entries; 1 page; 1,052 text characters |
| Protected download | Pass | First download returned the valid DOCX; repeated consume returned 404 |
| Live Supabase and Upstash | Pass | 25 RLS tables; 35 public policies; private bucket; queue depth zero; fresh worker heartbeat |
| Dedicated worker | Pass locally | Live Upstash and Supabase job produced a valid 66,511-byte DOCX; heartbeat recorded `processed/completed` |
| Exact 25 MB worker path | Pass | 26,214,400-byte PDF; 4.688 s queue; 2.573 s processing; valid 66,511-byte DOCX |
| Browser signed upload | Pass | `/api/uploads/pdf-to-word` 201; direct private upload; job 202; DOCX download 200 |
| Authenticated cleanup | Pass | Completed run with zero file, session, or conversion-job failures |
| Authenticated health | Pass | All critical checks healthy; queue pending 0 and processing 0 |
| Upload boundaries | Partial live | Exact 25 MB passed end to end; 200 MB application validator passed but Supabase Free is fixed at 50 MB |
| New upload/security/cleanup tests | Pass | 11/11 |
| Full regression | Pass | 605/605 across 124 files |
| TypeScript | Pass | `tsc --noEmit` |
| ESLint | Pass | Zero errors; 18 existing warnings |
| Production build | Pass | 154/154 static pages; direct-upload and worker routes generated |
| Production dependency audit | Pass | Zero moderate, high, or critical production vulnerabilities |

Evidence files:

- `quality/phase1-corpus/manifest.json`
- `quality/phase1-corpus/latest-report.json`
- `quality/phase1-corpus/engine-report.json`
- `quality/phase1-corpus/upload-boundary-report.json`
- `quality/phase1-corpus/local-api-smoke-report.json`
- `supabase/migrations/021_phase1_conversion_operations.sql`
- `supabase/migrations/022_payment_processing_updated_at.sql`
- `scripts/phase1-dedicated-worker-smoke.ts`

## Phase 1 workstream status

| Workstream | Weight | Complete | Status |
|---|---:|---:|---|
| 200-document quality corpus | 20% | 20% | Local gate passed |
| Output validation and fidelity evidence | 15% | 15% | Local gate passed |
| Engine routing and fallback evidence | 10% | 10% | Local gate passed |
| Queue, worker, retry, and crash recovery | 20% | 19% | Live local worker passed; persistent worker host pending |
| Private storage and deletion evidence | 15% | 14% | Private bucket and cleanup pass; timed retention drill pending |
| 25/200 MB load path | 10% | 9% | Exact 25 MB passed; Free storage blocks 200 MB |
| Monitoring and alerting | 10% | 8% | Detailed health is live; external alert delivery pending |
| **Total** | **100%** | **95%** | **Do not start Phase 2** |

## Required live activation gate

1. **Completed:** Supabase and Upstash are configured, migrations 001–022 are applied, and the bucket is private.
2. **Partial:** The dedicated worker passed locally against live services. Deploy it on a persistent host with restart policy and resource limits.
3. **Completed:** Authenticated `/api/health` reports healthy private storage, queue, worker, conversion, and cleanup checks.
4. **Partial:** A manual authenticated cleanup passed. Schedule it, observe the two-hour retention boundary, and run one controlled failed-object retry.
5. **Partial:** The exact 25 MB path passed. Upgrade storage or choose another provider, then pass the 200 MB Pro path.
6. **Pending:** Attach and trigger external health-degradation and worker-restart alerts.

After the remaining checks pass, Phase 1 can be marked 100% and readiness can move from 81 to 82. Only then should Phase 2 begin.
