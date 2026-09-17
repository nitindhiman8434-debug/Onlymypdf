# OnlyMyPDF — Operations Runbook

Production operations guide for monitoring, deployments, backups, conversion workers, and incident response.

## Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Public liveness (`200` JSON with `status`) |
| `GET /api/health` + `Authorization: Bearer $HEALTH_CHECK_SECRET` or `x-health-key` | Detailed checks (Upstash, DB, private storage, worker heartbeat, secrets) |
| `GET /status` | Public status page (polls `/api/health`; links external page when configured) |
| Vercel/host dashboard | Process uptime, memory, cold starts |

**Probe example (public liveness)**

```bash
curl -fsS https://yourdomain.com/api/health
curl -fsS https://yourdomain.com/status
```

**Detailed diagnostics (requires secret)**

```bash
curl -fsS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" https://yourdomain.com/api/health
```

Public response: `{ "status": "ok", "timestamp": "..." }`. Authenticated response includes queue depth, worker heartbeat, private-bucket status, direct-upload security, 24-hour conversion success/validity/fallback/latency metrics, database checks, and the latest cleanup run.

## Status page

| Mode | Config | User-facing |
|------|--------|-------------|
| Built-in | (default) | Footer → `/status`; polls `/api/health` every 60s |
| External | `NEXT_PUBLIC_STATUS_PAGE_URL=https://…` | Footer → external URL; `/status` shows link + live check |

Setup guide: `docs/STATUS_PAGE.md` (Better Stack, Instatus, etc.). Point external monitors at `GET /api/health`.

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to `main`/`master` | Lint, typecheck, unit + E2E tests, build |
| `cd.yml` | After CI succeeds on `main`/`master`, or manual | Docker build (slim + full), optional GHCR push, production smoke |
| `deploy-smoke.yml` | After CI or manual | Health + sitemap smoke against `PRODUCTION_URL` |

**CI steps** (`.github/workflows/ci.yml`):

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:coverage` (Vitest, 32% scoped gate)
5. `npm run audit:ci` — production dependencies only (`npm audit --omit=dev --audit-level=high`)
6. `npm run build`
7. `npm run test:e2e` (Playwright — smoke, a11y, CWV/perf budgets)

Local E2E verification (production server, matches CI):

```bash
npm run build
$env:GITHUB_ACTIONS='true'; npm run test:e2e:verify   # PowerShell
# bash: GITHUB_ACTIONS=true npm run test:e2e:verify
```

Quick smoke only: `npm run test:e2e:smoke`

Optional locally:
- `npm run audit:dev` — full dependency tree, high+ only (should pass after dev tooling cleanup)
- `npm run audit:moderate` — includes development-only findings for review

Local equivalent:

```bash
make ci
# or
npm run lint && npm run typecheck && npm run test:coverage && npm run build
```

See `docs/TESTING.md` for the full test pyramid (unit, PDF integration, Playwright E2E).

**CD** (`.github/workflows/cd.yml`):

- Builds `Dockerfile` (slim) and `Dockerfile.full` (LibreOffice + Python) on every successful CI run on `main`/`master`.
- Manual dispatch: set `push_image: true` to push to GHCR; optional `target_url` for post-deploy smoke.
- Set repository secret `PRODUCTION_URL` for automatic smoke after CI.

Dependabot (`.github/dependabot.yml`) opens weekly npm/GitHub Actions update PRs.

## Dependency audit policy

`npm audit --omit=dev --audit-level=moderate` must pass with zero production findings. The development tree currently has a Vitest mocker advisory that requires a breaking Vitest 5 upgrade; it is not shipped in the application or worker images built with production-only dependencies.

`npm run audit:ci` (`npm audit --omit=dev --audit-level=high`) must continue to pass on production dependencies. `npm run audit:dev` audits the full tree at high+. Use `npm run audit:moderate` manually to surface accepted moderate findings.

## Scheduled jobs

| Job | Route | Auth |
|-----|-------|------|
| File cleanup + consent purge (3yr) + usage logs (90d) + AI usage logs (90d) + error logs (90d) | `GET /api/cron/cleanup` | `Authorization: Bearer $CRON_SECRET` or Vercel `x-vercel-cron` (on Vercel only) |
| Recover/drain conversion queue | `GET /api/cron/conversion-worker?maxJobs=1` | `Authorization: Bearer $CRON_SECRET` or Vercel `x-vercel-cron` |

Cleanup also deletes orphaned previews and staged PDF-to-Word inputs/outputs after their TTL and records deletion failures in `cleanup_runs`.

Configure in Vercel Cron or external scheduler with **Bearer auth only** — never expose `CRON_SECRET` in client code or query strings.

## Database migrations

Run in order in Supabase SQL Editor (or `supabase db push`):

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Core tables, storage |
| `002_security_hardening.sql` | RLS policies |
| `003_security_rls_payments.sql` | Payment tables RLS |
| `004_security_rls_admin_tables.sql` | Admin RLS |
| `005_scalability_privacy.sql` | Indexes, `consent_records`, retention helpers |
| `006_payment_retention_on_delete.sql` | Billing records retained on account delete |
| `007_payment_processing_status.sql` | Atomic payment fulfillment (`processing` status) |
| `008_user_blocked_storage.sql` | `is_blocked` on profiles + storage policy notes |
| `009_profile_block_coupon_atomic.sql` | Block self-unblock via RLS; atomic coupon increment RPC |
| `010_admin_audit_log.sql` | Admin audit trail table (service-role writes) |
| `011_storage_rls_fix.sql` | Storage RLS fixes |
| `012_enterprise_orgs_api_keys.sql` | Organizations, members, API keys |
| `013_enterprise_billing.sql` | Org billing, invites |
| `014`–`020` | Atomic usage, billing reconciliation, MFA/webhook and medium security hardening |
| `021_phase1_conversion_operations.sql` | Conversion metrics, cleanup runs, queue fields, private bucket enforcement |

After each migration, verify in Table Editor and run a smoke test (upload → convert → download).

**Production gate:** Do not deploy until authenticated `/api/health` returns `healthy` (not `degraded`) with Upstash, Supabase, and required secrets configured.

## Environment variables

**Required in production:**

```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
HEALTH_CHECK_SECRET=
UPLOAD_GRANT_SECRET=       # optional dedicated key; otherwise CRON_SECRET fallback
JOB_PAYLOAD_SECRET=        # optional dedicated key; otherwise CRON_SECRET fallback
IP_HASH_SALT=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# For the 200 MB PDF→Word path on Cloudflare R2:
NEXT_PUBLIC_FILE_STORAGE_PROVIDER=r2
FILE_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=onlymypdf-files
```

**Billing** — use mock mode until Razorpay is live:

```env
BILLING_MODE=mock   # dev/staging — no gateway required
# BILLING_MODE=live
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=
# RAZORPAY_WEBHOOK_SECRET=
# NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

**Strongly recommended for production:**

```env
RESEND_API_KEY=          # contact form, password reset, team invites
EMAIL_FROM=
CONTACT_INBOX_EMAIL=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_STATUS_PAGE_URL=   # external status (optional)
```

**Optional:**

```env
GEMINI_API_KEY=          # AI summarizer
MAX_CONCURRENT_HEAVY_JOBS=2
CONVERTAPI_SECRET=       # cloud PDF→Word on slim Docker
PDF2DOCX_PYTHON=         # local pdf2docx (Dockerfile.full sets this)
LIBREOFFICE_PATH=        # local Office conversions (Dockerfile.full sets this)
```

When **Upstash** and private object storage are configured:

- **Heavy conversions** share a distributed semaphore. PDF-to-Word additionally uses durable Redis pending/processing queues and private staged storage. Without Upstash in production, heavy routes fail closed.
- **Large PDF-to-Word uploads** go browser → signed private R2 or Supabase upload → durable queue, so file bytes do not cross the app server request body. Supabase Free remains capped at 50 MB; select R2 for the tested 200 MB path.
- **Dedicated worker health** is written to Upstash every 15 seconds and becomes unhealthy after 60 seconds without a fresh heartbeat.
- **PDF preview sessions** persist metadata in Redis and PDF bytes in bucket `pdf-files` under `temp-sessions/pdf/{sessionId}.pdf` (30 min TTL).

See `docs/PRODUCTION_CHECKLIST.md` and `.env.example` for the full list.

## Retention & privacy

- Guest uploads: auto-delete after **2 hours**
- Pro uploads: auto-delete after **24 hours**
- Usage logs: **90 days** (purged by cleanup cron)
- Admin audit logs: **90 days** (`purgeOldAdminAuditLogs` in `/api/cron/cleanup`; see `ADMIN_AUDIT_RETENTION_DAYS` in `src/lib/admin/audit-retention.ts`)
- Cookie consent stored in `consent_records` (migration 005)
- Account erasure: `DELETE /api/user/account` (authenticated)

## Docker (optional)

| Image | File | Conversions |
|-------|------|-------------|
| Slim (default) | `Dockerfile` | App only — use `CONVERTAPI_SECRET` or client-side tools |
| Full | `Dockerfile.full` | Debian + LibreOffice + Python (`pdf2docx`) |
| Worker | `Dockerfile.worker` | Isolated PDF-to-Word queue worker with CPU, memory, PID, capability and temporary-storage limits in Compose |

```bash
# Slim — app only
docker build -t onlymypdf .
docker run -p 3000:3000 --env-file .env.production onlymypdf

# Full — self-hosted conversions (no pipeline code changes)
docker build -f Dockerfile.full -t onlymypdf:full .
docker run -p 3000:3000 --env-file .env.production onlymypdf:full

# Durable conversion worker
docker compose up -d conversion-worker
```

Uses Next.js `output: "standalone"` from `next.config.ts`. Node **20+** (see `.nvmrc`).

**Slim image limitations:** LibreOffice, Python (pdf2docx), and Puppeteer are **not** included — PDF→Word on slim Docker requires `CONVERTAPI_SECRET` or a sidecar. Rate limits and PDF→Word async jobs require Upstash Redis.

**Full image:** Sets `LIBREOFFICE_PATH=/usr/bin/soffice` and `PDF2DOCX_PYTHON=/usr/bin/python3`. Puppeteer/Chromium is still not bundled — HTML→PDF may need separate setup per deployment guide.

## Backup & disaster recovery

1. **Supabase**: enable daily backups (Pro plan); export schema periodically.
2. **Storage**: `pdf-files` bucket is ephemeral by design; no long-term backup required for user files.
3. **Secrets**: store in Vercel/host secret manager; rotate `CRON_SECRET` and `IP_HASH_SALT` on compromise.
4. **Recovery**: redeploy from `main`, re-run migrations 001–021 on fresh DB if needed, restore env vars, verify `/api/health`, `/status`, the worker queue, cleanup status, and one tool conversion.

## Incident checklist

1. Check `/status` and external status page (`NEXT_PUBLIC_STATUS_PAGE_URL`).
2. Run authenticated `/api/health` for component-level failures.
3. Review Vercel/runtime logs and Supabase logs.
4. Confirm cron cleanup is running (stale files filling storage).
5. Verify Redis rate limits if abuse spike.
6. Roll back deployment via host dashboard if recent release correlates with outage.

## On-call contacts

Update with your team:

- Engineering: support@onlymypdf.in
- Supabase project dashboard
- Razorpay merchant dashboard (payment issues — live billing only)
