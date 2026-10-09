# OnlyMyPDF — Production Environment Checklist

## Current release gates — 9 October 2026

This is a launch checklist, not proof of a running public deployment. The user
has retained the no-paid-plan decision. Local implementation and publication
checks do not close the production gates below. Do not enable billing, create
paid resources or expose the development preview as part of this checklist.

| Gate | Required evidence | Current disposition |
|---|---|---|
| English product claims | Tool, pricing, privacy, trust, status and structured-data copy agrees with implemented behavior and retained tests | Scoped Phase 3.6 local review complete; see its verification report |
| Public HTTPS conversion | Real downloaded Word, Excel and PowerPoint outputs, failure handling and private access on the selected deployment | Deferred; no public launch approval in this task |
| Limits and resource use | Representative small/typical/large documents and concurrency; observed CPU, RAM, disk, queue/processing time and failure rate | Pending production measurements; plan upload caps are not processing-capacity proof |
| Retention and deletion | Expired download denied; persistent, preview and Word-staging objects removed; failed deletion retried; scheduler freshness observed | Pending on the new deployment |
| Actual provider cost | Measured usage and invoice-based cost per job under an approved budget | Pending; local wall time cannot establish a provider bill |
| Real customer evidence | Five actual customers submit their own consented feedback after eligible conversions; privacy/withdrawal workflow checked | Still 0/5 in the recorded project evidence; no synthetic substitution |
| Legal/commercial readiness | Operator and monitored contact confirmed; independent review and payment activation decisions made by the operator | Separate external decisions; copy consistency is not legal certification |

The public `/status` check proves only an application response and basic
configuration status. Even detailed health's aggregate result must not replace
inspection of `cleanup_last_run`, `storage_cleanup`, worker freshness, private
bucket settings and real artifacts. Define rollback/disable criteria before a
pilot: invalid output, leaked access, sustained failures, stale cleanup or
unapproved spend. Keep live checkout disabled until separately verified.



Copy this checklist when deploying to Vercel, Docker, or any host. Production requires a private storage bucket, migration 023's durable Supabase queue, and an isolated conversion worker.



## Required (app will not start safely without these in production)



| Variable | Purpose |

|----------|---------|

| `NEXT_PUBLIC_APP_URL` | Canonical site URL (e.g. `https://onlymypdf.in`; verify domain ownership and HTTPS before launch) |

| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |

| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB/storage (never expose to client) |

| `CRON_SECRET` | Authorizes `/api/cron/cleanup` and `/api/cron/conversion-worker` |
| `HEALTH_CHECK_SECRET` | Authorizes detailed `/api/health`; do not reuse `CRON_SECRET` |
| `UPLOAD_GRANT_SECRET` | Recommended dedicated HMAC key for owner-bound direct-upload grants; falls back to `CRON_SECRET` |
| `JOB_PAYLOAD_SECRET` | Recommended dedicated AES-GCM key for queued PDF passwords; falls back to `CRON_SECRET` |

| `IP_HASH_SALT` | Hashes guest IPs for rate limits / logs |

| `CONVERSION_QUEUE_PROVIDER` | Set to `supabase` after migration 023 |
| `CONVERSION_WORKER_RUNTIME` | `dedicated` for an always-running worker; `scheduled` for authenticated scale-to-zero queue drains |

Upstash variables are optional rollback compatibility only.



## Payments (live checkout)



Use `BILLING_MODE=disabled` for a production preview with checkout unavailable. `BILLING_MODE=mock` is local/staging only and is rejected in production.



| Variable | Purpose |

|----------|---------|

| `BILLING_MODE` | `disabled` (safe production preview), `mock` (local/staging only), or `live` (Razorpay) |

| `RAZORPAY_KEY_ID` | Payment order creation |

| `RAZORPAY_KEY_SECRET` | Payment verification |

| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC validation |

| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client checkout (same as key ID) |

| `RAZORPAY_PRO_MONTHLY_PLAN_ID` | Auto-renew Pro (optional) |

| `RAZORPAY_PRO_YEARLY_PLAN_ID` | Auto-renew Pro yearly (optional) |



## Strongly recommended (production)



| Variable | Purpose |

|----------|---------|

| `RESEND_API_KEY` | **Required for production email** — contact form, password reset, team invites |

| `EMAIL_FROM` | Verified sending identity (e.g. `OnlyMyPDF <noreply@onlymypdf.in>` only after domain verification) |

| `CONTACT_INBOX_EMAIL` | Inbox for `/api/contact` (default: `support@onlymypdf.in`) |

| `SENTRY_DSN` | Error monitoring (set `NEXT_PUBLIC_SENTRY_DSN` for client) |

| `NEXT_PUBLIC_STATUS_PAGE_URL` | External status page (Better Stack / Instatus) — see `docs/STATUS_PAGE.md` |



## Optional features



| Variable | Purpose |

|----------|---------|

| `GEMINI_API_KEY` | AI PDF summarizer (full AI mode) |

| `OPENAI_API_KEY` | Alternate AI provider if configured |

| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Drive picker on tool pages |

| `NEXT_PUBLIC_DROPBOX_APP_KEY` | Dropbox picker |

| `CONVERTAPI_SECRET` | Optional external PDF→Word provider; output quality and cost require separate verification |

| `PDF2DOCX_PYTHON` | Path to Python for pdf2docx fallback |

| `LIBREOFFICE_PATH` | Path to `soffice` — powers PDF→Word, Word→PDF, Excel→PDF, PPT→PDF |

| `BILLING_GSTIN` / `BILLING_LEGAL_NAME` | GST tax invoices |



## GitHub Actions secrets



| Secret | Purpose |

|--------|---------|

| `PRODUCTION_URL` | Actual approved HTTPS deployment used by post-deploy smoke; confirm its target before running |

| `HEALTH_CHECK_SECRET` | Authenticated detailed health check in deploy smoke |



## Database (run once per environment)



Execute in order in Supabase SQL Editor:



1. `supabase/migrations/001_initial_schema.sql`

2. `supabase/migrations/002_security_hardening.sql`

3. `supabase/migrations/003_security_rls_payments.sql`

4. `supabase/migrations/004_security_rls_admin_tables.sql`

5. `supabase/migrations/005_scalability_privacy.sql`

6. `supabase/migrations/006_payment_retention_on_delete.sql`

7. `supabase/migrations/007_payment_processing_status.sql`

8. `supabase/migrations/008_user_blocked_storage.sql`

9. `supabase/migrations/009_profile_block_coupon_atomic.sql`

10. `supabase/migrations/010_admin_audit_log.sql`

11. `supabase/migrations/011_storage_rls_fix.sql`

12. `supabase/migrations/012_enterprise_orgs_api_keys.sql`

13. `supabase/migrations/013_enterprise_billing.sql`

14. `supabase/migrations/014_atomic_daily_usage.sql`

15. `supabase/migrations/015_billing_invoice_retention.sql`

16. `supabase/migrations/016_payment_reconciliation.sql`

17. `supabase/migrations/017_coupon_active_expiry_and_rollback.sql`

18. `supabase/migrations/018_payment_fulfilled_marker.sql`

19. `supabase/migrations/019_security_rls_mfa_webhooks.sql`

20. `supabase/migrations/020_security_medium.sql`

21. `supabase/migrations/021_phase1_conversion_operations.sql`

22. `supabase/migrations/022_payment_processing_updated_at.sql`

23. `supabase/migrations/023_supabase_conversion_queue.sql`

24. `supabase/migrations/024_verified_customer_feedback.sql`

Check the target environment's applied migrations first; this list is not an
instruction to rerun already-applied migrations.



Configure **Storage** bucket `pdf-files` as **private** (see `DEPLOYMENT_GUIDE.md`).



## CI / CD



| Workflow | Trigger | Purpose |

|----------|---------|---------|

| `ci.yml` | Push/PR to `main`/`master` | Lint, typecheck, unit + E2E tests, build |

| `cd.yml` | After CI succeeds on `main`/`master` | Docker build (slim + full), optional GHCR push, production smoke |

| `deploy-smoke.yml` | After CI or manual | Health + sitemap smoke against `PRODUCTION_URL` |



## Post-deploy verification



```bash

curl -fsS https://yourdomain.com/api/health

curl -fsS https://yourdomain.com/status

curl -fsS https://yourdomain.com/robots.txt

curl -fsS https://yourdomain.com/sitemap.xml

curl -fsS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" https://yourdomain.com/api/health

```



Manual checks:



- [ ] Contact form sends email (requires `RESEND_API_KEY`)

- [ ] Cookie banner → dashboard settings syncs to server

- [ ] Cron cleanup runs hourly (Vercel cron + `CRON_SECRET`, or external scheduler with Bearer auth)
- [ ] Either a dedicated worker is continuously running, or scheduled mode calls `/api/cron/conversion-worker?maxJobs=1` at least once per minute
- [ ] Inspect detailed health's individual storage, upload-security, queue, worker and cleanup records; verify actual conversions independently of aggregate health
- [ ] Test representative files at each supported per-tool cap through ingress, worker, storage and download; a padded 200 MB transport fixture is not complex-document capacity evidence

- [ ] Upload → convert → download on one tool (smoke test)

- [ ] External status page linked when `NEXT_PUBLIC_STATUS_PAGE_URL` is set



## Docker



| Image | File | Conversions |

|-------|------|-------------|

| Slim (default) | `Dockerfile` | App only — use `CONVERTAPI_SECRET` or client-side tools |

| Full | `Dockerfile.full` | Includes LibreOffice + Python (`pdf2docx`) |
| Worker | `Dockerfile.worker` | Durable PDF-to-Word worker; use Compose resource and security limits |



```bash

docker build -f Dockerfile.full -t onlymypdf:full .

docker run -p 3000:3000 --env-file .env.production onlymypdf:full

```



## Branding



The current brand name is `APP_NAME` in `src/config/constants.ts`. Set the
approved canonical URL with `NEXT_PUBLIC_APP_URL`; changing an unused brand
environment variable does not change the site.



See `docs/TESTING.md`, `docs/PRODUCTION_CHECKLIST.md`, and `.env.example`.
