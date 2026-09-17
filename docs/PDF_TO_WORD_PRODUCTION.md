# PDF → Word — Production Setup (ConvertAPI Primary)

This guide covers high-traffic production deployment for OnlyMyPDF PDF→Word conversions.

## Recommended architecture (big traffic)

```
User upload → private R2/Supabase object → Redis queue → Worker converts → private object → Download
                              ↓
                    1. ConvertAPI (primary)
                    2. pdf2docx (Linux fallback)
                    3. visual / node (last resort, small PDFs)
```

**Do not use Word COM as primary in production.** It is single-machine, slow, and hard to scale. Keep it for local Windows dev only.

---

## Step 1 — ConvertAPI account

1. Sign up at [convertapi.com](https://www.convertapi.com/)
2. Dashboard → **Secret** → copy API secret
3. Enable PDF → DOCX conversion (included in standard plans)
4. Note pricing: pay-per-conversion; budget ~$0.01–0.05 per file depending on plan/pages

---

## Step 2 — Production environment variables

Add to Vercel / Docker / your host:

```env
# Required for scale + quality (Smallpdf-class layout)
CONVERTAPI_SECRET=your_live_secret

# Recommended: skip Word COM / LibreOffice on cloud workers
PDF_TO_WORD_CONVERTAPI_ONLY=1

# Optional tuning
CONVERTAPI_TIMEOUT_MS=180000

# Already required for async PDF→Word jobs at scale
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Lowest-cost 200 MB object path
NEXT_PUBLIC_FILE_STORAGE_PROVIDER=r2
FILE_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=onlymypdf-files
```

| Variable | Purpose |
|----------|---------|
| `CONVERTAPI_SECRET` | Cloud PDF→Word API (primary engine) |
| `PDF_TO_WORD_CONVERTAPI_ONLY=1` | Production mode: ConvertAPI → pdf2docx → visual only |
| `CONVERTAPI_TIMEOUT_MS` | Max wait per API call (default 180s) |
| `UPSTASH_REDIS_*` | Job queue + rate limits across instances |
| `FILE_STORAGE_PROVIDER=r2` | Use private Cloudflare R2 objects instead of the Supabase 50 MB Free limit |
| `R2_*` | Server-only R2 S3 credentials and private bucket |

---

## Step 3 — Engine priority (automatic, simplified)

The orchestrator runs **at most 2 primary engines** plus small-PDF emergency fallbacks — not a 6-engine sequential chain.

When `CONVERTAPI_SECRET` is set:

| PDF type | Primary engines | Emergency (small PDFs only) |
|----------|-----------------|------------------------------|
| Design / poster | ConvertAPI → Word COM (Windows) or pdf2docx | visual → node |
| Text-rich manual (64+ pages) | ConvertAPI → pdf2docx | visual → node |
| Hybrid scanned (journal figures) | ConvertAPI → pdf2docx → Word COM | visual |
| Linux / Vercel / Docker | ConvertAPI → pdf2docx | visual → node |

With `PDF_TO_WORD_CONVERTAPI_ONLY=1`:

**ConvertAPI → pdf2docx** (+ visual → node emergency for small PDFs). Word COM and LibreOffice are skipped.

Local Windows without ConvertAPI:

| PDF type | Primary engines |
|----------|-----------------|
| Design / poster | Word COM → pdf2docx |
| Text-rich manual | pdf2docx → Word COM |

Large PDFs (>40 MB) skip visual/node emergency engines to avoid OOM/timeouts.

---

## Step 4 — Verify deployment

### Public health

```bash
curl -fsS https://onlymypdf.com/api/health
```

### Detailed health (requires `HEALTH_CHECK_SECRET`)

```bash
curl -fsS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" https://onlymypdf.com/api/health
```

Look for:

```json
"convertapi": { "ok": true, "detail": "Primary PDF→Word engine (cloud)" }
```

### Manual conversion test

1. Upload a design-heavy PDF (infographic, poster, invoice)
2. Check response header or job status: `X-Pdf-Engine: convertapi`
3. Open DOCX — page size, text, and images should match PDF layout

---

## Step 5 — Scaling checklist

| Item | Action |
|------|--------|
| Async jobs | Use existing `/api/tools/pdf-to-word` job flow (Redis-backed) |
| Concurrency | Default `MAX_CONCURRENT_HEAVY_JOBS=8` per instance (raise on dedicated workers) |
| File limits | Pro: 200 MB through R2; files above an engine limit must use a validated local worker engine |
| Monitoring | Alert if `convertapi.ok: false` in detailed health |
| Cost control | Monitor ConvertAPI dashboard; set monthly spend cap |
| Fallback | pdf2docx on full Docker image if ConvertAPI is down |

---

## Docker image choice

| Image | PDF→Word |
|-------|----------|
| **Slim** (`Dockerfile`) | Requires `CONVERTAPI_SECRET` — recommended for production |
| **Full** (`Dockerfile.full`) | ConvertAPI + pdf2docx + LibreOffice fallbacks |

For big traffic: **Slim + ConvertAPI + Redis queue**.

---

## CI quality regression (no Word runner)

GitHub Actions runs lightweight tests on every PR:

- `pdf-to-word-quality.ci.test.ts` — rejects raster page exports, accepts poster layouts
- `pdf-to-word-engine-plan` — ConvertAPI stays first when configured
- `pdf-to-word-convertapi.service.test.ts` — retry on 429

Run locally:

```bash
npm run test:pdf-to-word-quality
```

---

## Local development (no ConvertAPI)

Windows with Microsoft Word installed:

- Word COM runs automatically when `CONVERTAPI_SECRET` is unset
- Good for testing infographic/layout PDFs without API cost

To test ConvertAPI locally:

```env
CONVERTAPI_SECRET=your_secret
PDF_TO_WORD_CONVERTAPI_ONLY=1
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Output is full-page PNG images | ConvertAPI/Word COM failed; check secret and health |
| `convertapi.ok: false` | Set `CONVERTAPI_SECRET` in production env |
| Slow conversions | Normal for large PDFs; use async job + polling UI |
| ConvertAPI 429 | Auto-retries once; upgrade plan or add queue backoff |
| High cost | Enable `PDF_TO_WORD_CONVERTAPI_ONLY=1`; disable unnecessary fallbacks |
| Browser R2 upload blocked | Add the production origin and localhost development origin to the bucket CORS `PUT` allowlist |

---

## Related docs

- `docs/OPERATIONS.md` — Redis, rate limits, slim Docker limits
- `docs/PRODUCTION_CHECKLIST.md` — full deploy checklist
- `.env.example` — all optional conversion vars
