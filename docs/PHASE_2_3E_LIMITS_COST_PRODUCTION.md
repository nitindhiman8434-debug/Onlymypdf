# Phase 2.3E: measured limits, cost and production quality

**Started:** 22 September 2026

**Status:** In progress; public production gate is not passed.
**Phase 2 completion:** stays at 62% while this 5%-weight work package is incomplete.

## What is established

| Area | Evidence | Honest boundary |
|---|---|---|
| PDF-to-Word transport | The Phase 1 R2-to-Railway gate accepted an exact 209,715,200-byte, zero-padded valid PDF and produced an openable DOCX. | Padding tests byte transport; it does not prove fast or accurate conversion of a complex 200 MB document. |
| Excel semantics | 6/6 controlled PDF-to-Excel corpus cases passed on local and Ubuntu environments. | Complex tables, scans and 200 MB documents are not broadly validated. |
| PowerPoint semantics | 7/7 controlled PDF-to-PowerPoint corpus cases passed on local and Ubuntu environments. | Editable text is limited to supported visible selectable text; image scans remain visual slides. |
| Declared upload limits | Code defaults are 25 MB Free and 200 MB Pro; runtime admin settings can override them. | These are policy caps, not measured reliable limits for each converter. No unlimited-file-size promise is justified. |
| Public deployment | Railway project currently exposes two services: a private conversion worker and its watchdog. `NEXT_PUBLIC_APP_URL` in the local environment points to localhost. | No public web frontend URL or production Office HTTP gate is verified. |

## Packaging issue and correction

The full web Docker image originally copied the Next.js standalone output but not the dynamically invoked `scripts/` directory. It also installed `pdf2docx` without explicitly installing `python-pptx` and Pillow. Local corpus success therefore did not prove that the production web image could run PDF-to-Excel or PDF-to-PowerPoint.

`Dockerfile.full` now copies the converter scripts and installs their Python dependencies. The Phase 2.3D GitHub workflow builds the actual full image and runs both converter scripts against a tracked synthetic PDF inside that image. This is a source-level correction until its image CI job passes. The test checks real XLSX-extraction JSON and an openable PPTX package, rather than imports alone.

## HTTP and capacity gates

`npm run phase2.3e:http-smoke` sends the controlled two-page regression PDF to the Excel and PowerPoint API routes, checks content type, Office ZIP integrity and the expected editable fixture text, and records one wall-time sample for each tool. Set `PHASE2_3E_BASE_URL` to the deployment URL; set `PHASE2_3E_EXPECT_PUBLIC=1` to reject localhost and non-HTTPS targets. One sample is not a p95 latency or load test.

The first local run did **not** exercise the converters: the app returned HTTP 429 because this guest had already used its five daily free conversions. The request was blocked by the intended usage limit. The earlier `tsx` invocation also failed before HTTP because the Windows runtime could not resolve account information (`uv_os_get_passwd` reported `ENOMEM`); the smoke runner now uses plain Node and reached the app. Do not count either attempt as a conversion or quality result.

The first public gate needs an actual HTTPS frontend using the full image, configured Supabase, Upstash and R2, plus a working worker/watchdog. Then run controlled Word/Excel/PowerPoint uploads and verify downloaded DOCX/XLSX/PPTX bytes, editability, failure handling and cleanup. Measure at least small, typical and large realistic PDFs, plus concurrent jobs, while observing peak RAM/CPU, queue time, timeout/OOM, temporary disk, storage retention and invoice usage. Set per-tool supported caps from those results; a global 200 MB upload cap is not proof every Office route can process 200 MB.

## Cost baseline, not an invoice estimate

| Component | Current official price/limit | Implication |
|---|---|---|
| [Railway](https://railway.com/pricing) | $5 one-time trial credit for 30 days; Hobby has a $5 monthly minimum with $5 usage included. Usage is metered for CPU, RAM and service egress. | The private worker/watchdog consume credit even before a public frontend is added. On 22 September the Railway UI showed 26 days or $4.59 trial credit left. This is a point-in-time balance, not cost per conversion. |
| [Cloudflare R2 Standard](https://developers.cloudflare.com/r2/pricing/) | 10 GB-month storage, 1 million Class A and 10 million Class B operations free monthly; then $0.015/GB-month, $4.50/million A and $0.36/million B; egress is free. | Standard fits short retention better than Infrequent Access, which has no free tier and a 30-day minimum storage duration. |
| [Upstash Redis](https://upstash.com/pricing/redis) | Free: 256 MB data, 500,000 commands and 10 GB bandwidth per month. Pay-as-you-go: $0.20 per 100,000 commands, with other resource charges. | Count commands per job and failed retry before predicting monthly spend. A paid tier does not inherit the Free command allowance. |
| [Supabase](https://supabase.com/pricing) | Free: $0, 500 MB database, 5 GB egress; pauses after one inactive week. Pro starts at $25/month. | Free is suitable for a controlled beta, not a reliable always-on launch without checking usage and availability. |

For a low-cost controlled beta, use existing trial/free allocations and avoid a paid API. A dependable always-on public release may require at least Railway Hobby plus Supabase Pro (about $30/month minimum before resource overages), but that is a planning scenario, not a measured bill or a purchase decision. Per-job cost needs actual CPU-seconds, RAM-seconds, egress, R2 operations/storage, Redis commands and database usage from a representative load run.

## Exit gate

- Full production web image CI passes with both converter scripts and valid outputs.
- Public HTTPS frontend URL is deployed, configured and the three Office HTTP flows pass with inspected downloads.
- Realistic size and concurrency samples yield observed CPU/RAM/disk/latency/timeout and failure rates; per-tool support limits are set accordingly.
- Provider usage gives a defensible cost per conversion and monthly low/medium/high-volume scenarios.
- Retention and failure cleanup are observed in the deployed environment.

Until then, Phase 2.3E is **not 100% complete**, and Phase 2 overall remains **62%**.
