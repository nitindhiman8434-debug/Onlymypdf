# Phase 2.3E Supabase queue activation checkpoint

**Verified:** 23 September 2026  
**Code commit:** `0e1c51a`  
**Scope:** No-cost durable queue/coordination activation and localhost regression

## Result

Migration `023_supabase_conversion_queue.sql` was applied successfully to the OnlyMyPDF Supabase project. The SQL Editor reported `Success. No rows returned`.

An isolated live verification then created uniquely named test records, exercised every new coordination path, and removed those test records. No customer record or conversion output was used.

| Live gate | Result |
|---|---|
| Required public tables | 6/6 present |
| Row-level security | Enabled on 6/6 tables |
| Required RPC functions | 10/10 present |
| PGMQ queue | Enqueue, claim and acknowledge passed |
| Fixed-window rate limit | First request allowed; two requests remaining |
| Heavy-job semaphore | Lease acquired and released |
| One-time claim | First claim `true`; replay `false` |
| PDF session metadata | Insert passed |
| Test cleanup | Test job, rate-limit, lease, claim and session records removed |

The live queue message had `read_count = 1` and was acknowledged successfully. This validates the queue contract and database coordination primitives; it is not a public conversion load test.

## Local regression

The no-cost local preview remained available at `http://127.0.0.1:3001` with its forced in-memory queue profile. `/api/health` returned HTTP 200. A real local PDF-to-Word HTTP smoke produced:

- input: 2,311 bytes
- output: 37,721-byte DOCX
- engine: `pdf2docx`
- Office package openable: yes
- expected editable fixture text found: yes
- output validation: passed

This confirms local development no longer depends on Upstash. The preview deliberately disables cloud queue/storage/payment integrations in its child process.

## Cost protection

- No Railway web service was deployed.
- GitHub auto-deploy is disabled for the Railway worker and watchdog.
- The watchdog schedule is removed.
- The observed Railway trial balance was `$4.49` when these controls were applied.
- Upstash is no longer the default coordination provider. It remains a rollback adapter in code and can be removed after a stable hosted Supabase-worker soak.

## Completion boundary

The **no-cost Supabase queue activation subgate is complete**. Phase 2.3E as a public-launch gate is still open because the following intentionally deferred evidence does not exist yet:

- public HTTPS frontend and worker deployment
- realistic hosted concurrency and resource measurements
- hosted retention/failure drill through the new Supabase queue path
- measured provider cost per conversion
- p95 latency, timeout and OOM evidence

Cloud Run remains the preferred next compute option to evaluate when public deployment is authorized. Do not describe this checkpoint as a globally launched or unrestricted production service.
