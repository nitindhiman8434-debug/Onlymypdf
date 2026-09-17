# OnlyMyPDF — Production Environment Checklist



Copy this checklist when deploying to Vercel, Docker, or any host. **Conversion pipelines are unchanged** — these variables enable ops, contact, monitoring, and scale.



## Required (app will not start safely without these in production)



| Variable | Purpose |

|----------|---------|

| `NEXT_PUBLIC_APP_URL` | Canonical site URL (e.g. `https://onlymypdf.com`) |

| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |

| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB/storage (never expose to client) |

| `CRON_SECRET` | Authorizes `/api/cron/cleanup` and detailed `/api/health` (`Authorization: Bearer …` or `x-health-key`) |

| `IP_HASH_SALT` | Hashes guest IPs for rate limits / logs |

| `UPSTASH_REDIS_REST_URL` | **Required in production** — distributed rate limits, heavy-job semaphore, PDF sessions |

| `UPSTASH_REDIS_REST_TOKEN` | Upstash auth token |



## Payments (live checkout)



Skip when using mock billing (`BILLING_MODE=mock` for dev/staging).



| Variable | Purpose |

|----------|---------|

| `BILLING_MODE` | `mock` (no gateway) or `live` (Razorpay) |

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

| `EMAIL_FROM` | From address (e.g. `OnlyMyPDF <noreply@onlymypdf.com>`) |

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

| `CONVERTAPI_SECRET` | Best PDF→Word quality (Smallpdf-class cloud API) — see `docs/PDF_TO_WORD_PRODUCTION.md` |

| `PDF2DOCX_PYTHON` | Path to Python for pdf2docx fallback |

| `LIBREOFFICE_PATH` | Path to `soffice` — powers PDF→Word, Word→PDF, Excel→PDF, PPT→PDF |

| `BILLING_GSTIN` / `BILLING_LEGAL_NAME` | GST tax invoices |



## GitHub Actions secrets



| Secret | Purpose |

|--------|---------|

| `PRODUCTION_URL` | Post-deploy smoke in `cd.yml` / `deploy-smoke.yml` (e.g. `https://onlymypdf.com`) |

| `CRON_SECRET` | Authenticated detailed health check in deploy smoke |



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

curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/health

```



Manual checks:



- [ ] Contact form sends email (requires `RESEND_API_KEY`)

- [ ] Cookie banner → dashboard settings syncs to server

- [ ] Cron cleanup runs hourly (Vercel cron + `CRON_SECRET`, or external scheduler with Bearer auth)

- [ ] Upload → convert → download on one tool (smoke test)

- [ ] External status page linked when `NEXT_PUBLIC_STATUS_PAGE_URL` is set



## Docker



| Image | File | Conversions |

|-------|------|-------------|

| Slim (default) | `Dockerfile` | App only — use `CONVERTAPI_SECRET` or client-side tools |

| Full | `Dockerfile.full` | Includes LibreOffice + Python (`pdf2docx`) |



```bash

docker build -f Dockerfile.full -t onlymypdf:full .

docker run -p 3000:3000 --env-file .env.production onlymypdf:full

```



## Branding



Set `NEXT_PUBLIC_APP_NAME=OnlyMyPDF` to match SEO/canonical branding.



See `docs/TESTING.md`, `docs/PRODUCTION_CHECKLIST.md`, and `.env.example`.
