# Phase 2.3E: measured limits, cost and production quality

**Started:** 22 September 2026

**Status:** In progress. Production-image Office gate passed; public production gate is not passed.
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

`Dockerfile.full` now copies the converter scripts and installs their Python dependencies. The first full-image CI build also exposed a Puppeteer installation failure in the slim Node image: Chrome extraction needed a missing archive utility. The image now skips Puppeteer's download during `npm ci` and installs Debian Chromium explicitly in the runtime image. The Phase 2.3D GitHub workflow builds the actual full image and runs both converter scripts against a tracked synthetic PDF inside that image. The test checks real XLSX-extraction JSON and an openable PPTX package, rather than imports alone.

[GitHub Actions run 35651492549](https://github.com/nitindhiman8434-debug/Onlymypdf/actions/runs/35651492549) passed both the semantic corpus and the full-image runtime job. The full image built 154/154 static pages, found the Python converters and Chromium, extracted two tables from the two-page fixture, and produced a 33,206-byte PPTX with two editable slides. This resolves the missing-script and dependency packaging defect for the tested image. It does not prove a live HTTP deployment, a full Excel workbook through the API, or HTML-to-PDF's Chromium sandbox launch.

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

An earlier live R2 retention drill (`quality/phase1-corpus/retention-retry-report.json`) already passed controlled deletion-failure accounting and retry cleanup with the configured two-hour worker TTL. The new public frontend flow still needs its own end-to-end cleanup observation.

Until then, Phase 2.3E is **not 100% complete**, and Phase 2 overall remains **62%**.
