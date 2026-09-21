# Phase 2.3E: measured limits, cost and production quality

**Started:** 22 September 2026

**Status:** In progress. Production-image packaging and the no-cost local capacity/page-completeness gates passed; public production gate is not passed.
**Phase 2 completion:** stays at 62% while this 5%-weight work package is incomplete.

## What is established

| Area | Evidence | Honest boundary |
|---|---|---|
| PDF-to-Word transport | The Phase 1 R2-to-Railway gate accepted an exact 209,715,200-byte, zero-padded valid PDF and produced an openable DOCX. | Padding tests byte transport; it does not prove fast or accurate conversion of a complex 200 MB document. |
| Excel semantics | 6/6 controlled PDF-to-Excel corpus cases passed on local and Ubuntu environments. | Complex tables, scans and 200 MB documents are not broadly validated. |
| PowerPoint semantics | 7/7 controlled PDF-to-PowerPoint corpus cases passed on local and Ubuntu environments. | Editable text is limited to supported visible selectable text; image scans remain visual slides. |
| Declared upload limits | Code defaults are 25 MiB Free and 200 MiB Pro; runtime admin settings can override them. A 25,898,723-byte synthetic PDF (98.8% of the 25 MiB cap) converted to Word, Excel and PowerPoint locally. | This is one document shape on one development machine, not a reliable limit for every file or a deployed service. No unlimited-file-size promise is justified. |
| Public deployment | Railway project currently exposes two services: a private conversion worker and its watchdog. `NEXT_PUBLIC_APP_URL` in the local environment points to localhost. | No public web frontend URL or production Office HTTP gate is verified. |

## Packaging issue and correction

The full web Docker image originally copied the Next.js standalone output but not the dynamically invoked `scripts/` directory. It also installed `pdf2docx` without explicitly installing `python-pptx` and Pillow. Local corpus success therefore did not prove that the production web image could run PDF-to-Excel or PDF-to-PowerPoint.

`Dockerfile.full` now copies the converter scripts and installs their Python dependencies. The first full-image CI build also exposed a Puppeteer installation failure in the slim Node image: Chrome extraction needed a missing archive utility. The image now skips Puppeteer's download during `npm ci` and installs Debian Chromium explicitly in the runtime image. The Phase 2.3D GitHub workflow builds the actual full image and runs both converter scripts against a tracked synthetic PDF inside that image. The test checks real XLSX-extraction JSON and an openable PPTX package, rather than imports alone.

[GitHub Actions run 35651492549](https://github.com/nitindhiman8434-debug/Onlymypdf/actions/runs/35651492549) passed both the semantic corpus and the full-image runtime job. The full image built 154/154 static pages, found the Python converters and Chromium, extracted two tables from the two-page fixture, and produced a 33,206-byte PPTX with two editable slides. This resolves the missing-script and dependency packaging defect for the tested image. It does not prove a live HTTP deployment or HTML-to-PDF's Chromium sandbox launch. Local Excel HTTP downloads have since passed, but they are not a deployed-container HTTP test.

## HTTP and capacity gates

`npm run phase2.3e:http-smoke` sends the controlled two-page regression PDF to the Excel and PowerPoint API routes, checks content type, Office ZIP integrity and the expected editable fixture text, and records one wall-time sample for each tool. Set `PHASE2_3E_BASE_URL` to the deployment URL; set `PHASE2_3E_EXPECT_PUBLIC=1` to reject localhost and non-HTTPS targets. One sample is not a p95 latency or load test.

The first local run did **not** exercise the converters: the app returned HTTP 429 because this guest had already used its five daily free conversions. The request was blocked by the intended usage limit. The earlier `tsx` invocation also failed before HTTP because the Windows runtime could not resolve account information (`uv_os_get_passwd` reported `ENOMEM`); the smoke runner now uses plain Node. Do not count either attempt as a conversion or quality result.

### No-paid-plan local preview

The user chose local testing before any public Railway frontend deployment or paid-plan purchase. Run `npm run dev:local-preview` from the project directory and open `http://127.0.0.1:3001`. This opt-in profile binds to loopback, uses a separate Next build directory, and overrides Supabase, Upstash, R2, AI and payment keys only in its child process; `.env.local` is unchanged. The app's existing development fallback permits local conversion tests without consuming the production guest's five daily uses. Do not expose this profile on a public interface: its development auth and rate-limit behavior are deliberately different from production.

On 22 September 2026, the local preview homepage, PDF-to-Excel page and PDF-to-PowerPoint page rendered in the browser. Real HTTP uploads of the tracked two-page PDF then passed:

| Tool | Local HTTP result | Verification |
|---|---:|---|
| PDF to Word | 37,409-byte DOCX, `pdf2docx` engine | Guest job queue, completed status, download, Office ZIP CRC and editable fixture text passed. |
| PDF to Excel | 7,295-byte XLSX in 11.4 s including first-route compilation | Office ZIP CRC, two worksheets, editable fixture text and MIME passed. |
| PDF to PowerPoint | 33,303-byte PPTX in 2.2 s | Office ZIP CRC, two slides, editable fixture text and MIME passed. |

Commands: `npm run dev:local-preview:word-smoke`; in another terminal set `PHASE2_3E_BASE_URL=http://127.0.0.1:3001` and run `npm run phase2.3e:http-smoke`. The local Word result and Excel/PPT report are controlled-fixture results, not universal layout accuracy, large-file reliability, p95 speed or public deployment evidence. The local preview uses HTTP because it is confined to the user's own device; it does not verify the site's production HTTPS and retention claims. Cloud-dependent features and payments are intentionally unavailable in this preview.

### Last-page defect found and fixed

A stricter four-page Word check found only pages 1-3 in the downloaded DOCX while the PDF contained all four pages. The installed `pdf2docx` implementation treats its `end` argument as **exclusive**; the application had passed `page_count - 1` and inclusive chunk ends. `scripts/pdf-to-docx.py` and `scripts/pdf-to-docx-range.py` now pass the correct exclusive end for single-page-range, OCR-searchable and chunk paths. The API retest found all 4/4 and 8/8 editable page markers; the near-Free-cap retest found 22/22. `npm run phase2.3e:last-page` verified the first and last pages in single conversion, in-process chunks, subprocess chunks and the OCR conversion branch using a known searchable input. That OCR branch test does **not** exercise Tesseract recognition, which is unavailable on this Windows preview.

### No-cost capacity samples after the fix

`python scripts/phase2-local-capacity-fixtures.py` generates deterministic synthetic reports with selectable invoice rows and difficult-to-compress images. `npm run phase2.3e:local-capacity -- <case>` sends them through actual localhost HTTP routes. Results are in `quality/phase2-production/local-*-report.json`; outputs passed Office ZIP CRC and editable marker checks on every expected page.

| Input | Word | Excel | PowerPoint |
|---|---:|---:|---:|
| 4 pages, 4,712,092 bytes | 4/4 markers; 4.9 s; 16.5 MB DOCX | 4/4; 0.9 s | 4/4; 3.1 s |
| 8 pages, 9,419,544 bytes | 8/8; 6.1 s; 33.0 MB DOCX | 8/8; 1.7 s | 8/8; 3.7 s |
| 22 pages, 25,898,723 bytes | 22/22; 22.7 s; 90.7 MB DOCX | 22/22; 4.6 s | 22/22; 8.9 s; 52.4 MB PPTX |

The 22-page file is 98.8% of the configured 25 MiB Free cap (26,214,400 bytes). A separate 27,076,295-byte input received the expected HTTP 400 size rejection on **all three** Word, Excel and PowerPoint routes (`local-above-free-cap-report.json`). A parallel pair (4-page Excel and PowerPoint) and a new simultaneous three-tool run (4-page Word, Excel and PowerPoint) completed with valid Office outputs and 4/4 editable page markers (`local-parallel-mixed-report.json`). The Word job's completed download remained one-time (replay HTTP 404).

The first simultaneous three-tool run took 18.8 s wall time (Word 18.8 s, Excel 12.2 s, PowerPoint 14.0 s); a warm repeat took 4.8 s wall time (Word 4.8 s, Excel 1.7 s, PowerPoint 2.7 s). The cause of that first-run difference was not isolated; route compilation and local contention are possibilities, not confirmed diagnoses. One process snapshot during the first run showed roughly 1,858 MiB working set for the listening local Next server and 115 MiB for a Python process; the Python process was not independently attributed to a specific request. An earlier spot sample during the 20-page Word trial showed about 1,024 MB Windows memory available and about 2,153 MB RSS for the development server. Neither snapshot is a peak, child-process total or production Linux sizing result. These are individual development-machine samples, not p95 latency, a capacity guarantee or a 200 MiB Pro test.

After the Python fix, `tsc --noEmit`, 46 targeted PDF-to-Word tests, Python compile checks and the last-page regression passed. The tested local job download was one-time: replay returned HTTP 404. Existing local temporary job directories dated before this run remain; the current run left no new job directory visible. This is local cleanup evidence only, not deployed R2 retention evidence.

The first public gate needs an actual HTTPS frontend using the full image, configured Supabase, Upstash and R2, plus a working worker/watchdog. Then run controlled Word/Excel/PowerPoint uploads and verify downloaded DOCX/XLSX/PPTX bytes, editability, failure handling and cleanup. Measure at least small, typical and large realistic PDFs, plus concurrent jobs, while observing peak RAM/CPU, queue time, timeout/OOM, temporary disk, storage retention and invoice usage. Set per-tool supported caps from those results; a global 200 MB upload cap is not proof every Office route can process 200 MB.

## Cost baseline, not an invoice estimate

| Component | Current official price/limit | Implication |
|---|---|---|
| [Railway](https://railway.com/pricing) | The current Free offer has a $5 one-time, 30-day trial and then a $1 monthly resource allowance, with 1 GB RAM/service during trial and 0.5 GB afterward. Hobby has a $5 monthly minimum. Usage is metered for CPU, RAM and service egress. | The private worker/watchdog consume trial credit even before a public frontend is added. The earlier $4.59 trial balance is only a historical observation, not a current balance or cost per conversion. The local preview is not sized to Railway's Free service limits. |
| [Cloudflare R2 Standard](https://developers.cloudflare.com/r2/pricing/) | 10 GB-month storage, 1 million Class A and 10 million Class B operations free monthly; then $0.015/GB-month, $4.50/million A and $0.36/million B; egress is free. | Standard fits short retention better than Infrequent Access, which has no free tier and a 30-day minimum storage duration. |
| [Upstash Redis](https://upstash.com/pricing/redis) | Free: 256 MB data, 500,000 commands and 10 GB bandwidth per month. Pay-as-you-go: $0.20 per 100,000 commands, with other resource charges. | Count commands per job and failed retry before predicting monthly spend. A paid tier does not inherit the Free command allowance. |
| [Supabase](https://supabase.com/pricing) | Free: $0, 500 MB database, 5 GB egress; pauses after one inactive week. Pro starts at $25/month. | Free is suitable for a controlled beta, not a reliable always-on launch without checking usage and availability. |

The current localhost tests use no billable cloud conversion service. A dependable always-on public release may require paid compute and database tiers, but no plan has been purchased or selected. Per-job cost still needs actual deployed CPU-seconds, RAM-seconds, egress, R2 operations/storage, Redis commands and database usage from a representative load run. Local wall time alone cannot determine a provider invoice.

## Exit gate

- Full production web image CI passes with both converter scripts and valid outputs.
- Public HTTPS frontend URL is deployed, configured and the three Office HTTP flows pass with inspected downloads.
- Realistic size and concurrency samples yield observed CPU/RAM/disk/latency/timeout and failure rates; per-tool support limits are set accordingly. Synthetic localhost samples now cover three sizes up to 98.8% of the Free cap, a parallel pair and one simultaneous Word/Excel/PowerPoint run, but not a representative public workload or 200 MiB Pro files.
- Provider usage gives a defensible cost per conversion and monthly low/medium/high-volume scenarios.
- Retention and failure cleanup are observed in the deployed environment.

An earlier live R2 retention drill (`quality/phase1-corpus/retention-retry-report.json`) already passed controlled deletion-failure accounting and retry cleanup with the configured two-hour worker TTL. The new public frontend flow still needs its own end-to-end cleanup observation.

Until then, Phase 2.3E is **not 100% complete**, and Phase 2 overall remains **62%**.
