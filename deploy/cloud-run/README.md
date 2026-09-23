# Cloud Run low-cost deployment blueprint

This blueprint prepares OnlyMyPDF for a controlled public beta without a continuously running worker.

## Architecture

- One public Cloud Run service built from `Dockerfile.full`.
- One dedicated Cloud Build identity runs the build/deploy, and one separate runtime identity can read only the service secrets.
- Request-based billing with `min-instances=0`, so idle instances scale to zero.
- `max-instances=2` limits an unexpected traffic spike; `concurrency=1` prevents two heavy conversions sharing one container.
- Supabase PGMQ remains the durable queue and coordination store.
- One Cloud Scheduler job calls `/api/cron/conversion-worker?maxJobs=1` every minute. The route records a worker heartbeat and processes at most one queued job per invocation.
- One additional hourly Scheduler job calls `/api/cron/cleanup`.
- Billing checkout is set to `disabled`. No mock entitlement can run in production and no Razorpay secret is required until payments are intentionally activated.
- Cloudflare R2 remains private object storage.

This does not change any PDF conversion algorithm or output-selection logic.

## Current Google Cloud checkpoint (24 September 2026)

- Google Cloud project name: `OnlyMyPDF`
- Project ID: `onlymypdf-prod-2026`
- Project number: `861153394297`
- Billing account: not linked
- Cloud Run Admin API: not enabled; the console requires a linked billing account before it can be enabled
- Free trial: not activated
- Paid resources: none created

The project is reserved and ready for the prerequisites below. Stop at this checkpoint while the product remains local-only. Linking billing and enabling the deployment APIs is a later production action.

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
5. Create the dedicated build and runtime service accounts described below. Do not use the Compute Engine default account.
6. Supply the public Supabase URL/anon key, Turnstile site key, legal operator name and privacy email as Cloud Build substitutions.

Never put service-role, R2, signing, email or Turnstile secret values into Cloud Build substitutions, GitHub variables, committed YAML or shell history. Store them in Secret Manager.

## Dedicated identities and IAM

The blueprint is pinned to these user-managed accounts in project `onlymypdf-prod-2026`:

| Identity | Purpose | Access boundary |
|---|---|---|
| `onlymypdf-cloud-build@onlymypdf-prod-2026.iam.gserviceaccount.com` | Build, push and deploy | Cloud Run deployment, write to the single `onlymypdf` image repository, Cloud Logging, and permission to attach the runtime identity |
| `onlymypdf-runtime@onlymypdf-prod-2026.iam.gserviceaccount.com` | Run the web container | Secret Accessor on the named OnlyMyPDF secrets only |

Create the identities only when billing is linked and the listed APIs are enabled:

```powershell
$ProjectId = "onlymypdf-prod-2026"
$Region = "us-central1"
$Repository = "onlymypdf"
$BuildSa = "onlymypdf-cloud-build@$ProjectId.iam.gserviceaccount.com"
$RuntimeSa = "onlymypdf-runtime@$ProjectId.iam.gserviceaccount.com"
$Deployer = (gcloud config get-value account).Trim()

gcloud iam service-accounts create onlymypdf-cloud-build --project $ProjectId --display-name "OnlyMyPDF Cloud Build"
gcloud iam service-accounts create onlymypdf-runtime --project $ProjectId --display-name "OnlyMyPDF Cloud Run runtime"

gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$BuildSa" --role roles/run.admin
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$BuildSa" --role roles/logging.logWriter
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$BuildSa" --role roles/storage.objectViewer
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$BuildSa" --role roles/serviceusage.serviceUsageConsumer
gcloud artifacts repositories add-iam-policy-binding $Repository --project $ProjectId --location $Region --member "serviceAccount:$BuildSa" --role roles/artifactregistry.writer

gcloud iam service-accounts add-iam-policy-binding $RuntimeSa --project $ProjectId --member "serviceAccount:$BuildSa" --role roles/iam.serviceAccountUser
gcloud iam service-accounts add-iam-policy-binding $BuildSa --project $ProjectId --member "user:$Deployer" --role roles/iam.serviceAccountUser
```

Grant the runtime identity access to each referenced secret rather than granting project-wide Secret Accessor:

```powershell
$Secrets = @(
  "onlymypdf-supabase-service-role",
  "onlymypdf-r2-account-id",
  "onlymypdf-r2-access-key-id",
  "onlymypdf-r2-secret-access-key",
  "onlymypdf-cron-secret",
  "onlymypdf-health-check-secret",
  "onlymypdf-upload-grant-secret",
  "onlymypdf-job-payload-secret",
  "onlymypdf-step-up-secret",
  "onlymypdf-ip-hash-salt",
  "onlymypdf-sentry-dsn",
  "onlymypdf-resend-api-key",
  "onlymypdf-turnstile-secret-key"
)

foreach ($Secret in $Secrets) {
  gcloud secrets add-iam-policy-binding $Secret --project $ProjectId --member "serviceAccount:$RuntimeSa" --role roles/secretmanager.secretAccessor
}
```

`cloudbuild.yaml` rejects a runtime identity from another project, attaches the dedicated runtime account with `--service-account`, and declares the dedicated build account at the build level. Cloud Run checks secret access against the runtime identity before starting a revision.

## Build and deploy

After the prerequisites are complete:

```powershell
gcloud builds submit `
  --project onlymypdf-prod-2026 `
  --region us-central1 `
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
