# Cloud Run low-cost deployment blueprint

This blueprint prepares OnlyMyPDF for a controlled public beta without a continuously running worker.

## Architecture

- One public Cloud Run service built from `Dockerfile.full`.
- Request-based billing with `min-instances=0`, so idle instances scale to zero.
- `max-instances=2` limits an unexpected traffic spike; `concurrency=1` prevents two heavy conversions sharing one container.
- Supabase PGMQ remains the durable queue and coordination store.
- One Cloud Scheduler job calls `/api/cron/conversion-worker?maxJobs=1` every minute. The route records a worker heartbeat and processes at most one queued job per invocation.
- One additional hourly Scheduler job calls `/api/cron/cleanup`.
- Billing checkout is set to `disabled`. No mock entitlement can run in production and no Razorpay secret is required until payments are intentionally activated.
- Cloudflare R2 remains private object storage.

This does not change any PDF conversion algorithm or output-selection logic.

## Cost boundary

Google Cloud requires an active billing account even for Free Tier resources. The blueprint does not create a billing account or deploy anything by itself.

The service starts with conservative limits:

| Setting | Initial value |
|---|---:|
| Region | `us-central1` |
| CPU | 2 vCPU |
| Memory | 4 GiB |
| Minimum instances | 0 |
| Maximum instances | 2 |
| Container concurrency | 1 |
| Request timeout | 3,600 seconds |
| Worker schedule | once per minute |
| Cleanup schedule | hourly |

Cloud Run's monthly free allowance is usage based; it is not a hard spending cap. Configure a small billing budget and alerts before the first deployment. Budgets notify; they do not automatically stop resources.

## Prerequisites

1. Create or select one Google Cloud project and link an active billing account.
2. Enable Cloud Build, Cloud Run, Artifact Registry, Secret Manager and Cloud Scheduler APIs.
3. Create an Artifact Registry Docker repository named `onlymypdf` in `us-central1`.
4. Create the Secret Manager secrets referenced in `cloudbuild.yaml`.
5. Grant the Cloud Build service account permission to deploy Cloud Run and read only those secrets.
6. Supply the public Supabase URL/anon key, Turnstile site key, legal operator name and privacy email as Cloud Build substitutions.

Never put service-role, R2, signing, email or Turnstile secret values into Cloud Build substitutions, GitHub variables, committed YAML or shell history. Store them in Secret Manager.

## Build and deploy

After the prerequisites are complete:

```powershell
gcloud builds submit `
  --config deploy/cloud-run/cloudbuild.yaml `
  --substitutions "_SUPABASE_URL=https://PROJECT.supabase.co,_SUPABASE_ANON_KEY=PUBLIC_ANON_KEY,_TURNSTILE_SITE_KEY=PUBLIC_SITE_KEY,_LEGAL_OPERATOR_NAME=LEGAL_NAME,_PRIVACY_EMAIL=privacy@example.com"
```

The build calculates the deterministic service URL before compiling Next.js:

```text
https://onlymypdf-web-PROJECT_NUMBER.us-central1.run.app
```

The preflight step rejects placeholder public values. Secret Manager configuration is resolved only during deployment.

## Scheduler jobs

Create the two jobs only after the service health endpoint responds. Both requests must use the exact `CRON_SECRET` value stored in Secret Manager as a Bearer token.

```powershell
gcloud scheduler jobs create http onlymypdf-conversion-drain `
  --location us-central1 `
  --schedule "* * * * *" `
  --uri "SERVICE_URL/api/cron/conversion-worker?maxJobs=1" `
  --http-method GET `
  --headers "Authorization=Bearer CRON_SECRET_VALUE" `
  --attempt-deadline 1800s

gcloud scheduler jobs create http onlymypdf-cleanup `
  --location us-central1 `
  --schedule "0 * * * *" `
  --uri "SERVICE_URL/api/cron/cleanup" `
  --http-method GET `
  --headers "Authorization=Bearer CRON_SECRET_VALUE" `
  --attempt-deadline 1800s
```

The header commands above are operational templates. Entering the secret in a command can leave it in terminal history; prefer the Google Cloud Console or a protected automation environment when the jobs are created.

## Release gates

Do not call the beta production-ready until all of these pass against the Cloud Run URL:

1. Public `/api/health` returns HTTP 200.
2. Authenticated health reports Supabase queue, private R2 storage and fresh scheduled-worker heartbeat healthy.
3. Real Word, Excel and PowerPoint downloads have correct MIME/magic, open successfully and contain expected editable content.
4. Scheduler drain and cleanup jobs have successful executions.
5. Small, typical and near-limit files are timed; memory, CPU, queue delay, timeout and failure evidence is saved.
6. Test input/output objects disappear after retention cleanup.
7. Billing usage and Artifact Registry storage remain inside the intended budget.
