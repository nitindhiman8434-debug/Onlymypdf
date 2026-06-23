# OnlyMyPDF — System Architecture

## 1. High-level overview

```
                         ┌─────────────────────────────────────────┐
                         │              Cloudflare (CDN/WAF)         │
                         └───────────────────┬─────────────────────┘
                                             │ HTTPS
                                  ┌──────────▼──────────┐
                                  │        nginx        │  reverse proxy
                                  └─────┬──────────┬────┘
                       /api, /only-admin│          │ everything else
                                        │          │
                       ┌────────────────▼──┐   ┌───▼────────────────────┐
                       │   Laravel API     │   │     Next.js (SSR/SSG)   │
                       │  + Filament admin │   │  public site, tools,    │
                       │                   │   │  dashboard, i18n        │
                       └───┬──────────┬────┘   └─────────────────────────┘
              queues/cache │          │ metadata, credits
                    ┌──────▼───┐  ┌───▼─────┐
                    │  Redis   │  │  MySQL  │
                    │ Horizon  │  │ MariaDB │
                    └────┬─────┘  └─────────┘
                         │ job payloads (file ref + params)
              ┌──────────▼───────────┐
              │  Python heavy worker │  OCR, conversion, compression,
              │  (provider abstract) │  translate, AI summary
              └──────────┬───────────┘
                         │ reads/writes
              ┌──────────▼───────────┐
              │  Isolated temp store │  per-job folder, 1-hour TTL
              └──────────────────────┘
```

**Two processing planes:**

1. **Client-side (browser, no upload)** — Reader, Merge, Split, Rotate, Delete/Extract pages,
   Organize, JPG→PDF, simple Sign/Watermark, simple Protect/Unlock. Uses PDF.js + pdf-lib.
   UI message: *"Processed privately in your browser."*
2. **Server-side (queued)** — PDF↔Office, OCR, high compression, Translate, AI summary,
   HTML→PDF, High Accuracy conversions. UI message: *"Files auto-delete in 1 hour."*

## 2. Components

### Frontend — Next.js 14 (App Router)
- SSR/SSG for all public + SEO pages, one route per tool, Hindi mirror under `/hi/`.
- Tailwind + a shadcn-style component layer (`components/ui`).
- Framer Motion for the two hero modes (lazy-loaded, `prefers-reduced-motion` aware).
- i18n via `next-intl` style message catalogs (`messages/en.json`, `messages/hi.json`).
- Heavy PDF libs are **dynamically imported** only on the tool page that needs them.

### Backend — Laravel 11
- **API** (`routes/api.php`) — auth, tools, jobs, credits, payments, support, admin.
- **Filament admin** at `config('admin.path')` (env `ADMIN_PATH`, default `only-admin-panel`).
- **Horizon** manages Redis queues; **scheduler** runs cleanup / trial-expiry / credit-reset.
- Sanctum tokens for the SPA/PWA + future Ionic app (same backend, same login, same credits).

### Worker — Python
- Pulls jobs from a Redis list/stream, runs the right tool via the **provider abstraction**
  (`providers/` — local engines + commercial API fallback), writes output to the job's temp dir,
  posts status/quality back to Laravel via an internal signed callback.

## 3. Job lifecycle (server-side)

```
upload → validate → create tool_job (queued) → store temp file (isolated dir)
      → enqueue (priority by plan) → worker picks up
      → progress: uploading→checking→reading→optimizing→processing→quality→preparing
      → validate output → store output temp → signed download URL → result page
      → auto-delete input+output after 1h (Delete Now also available)
      → persist metadata only if logged in (file_metadata row)
```

### Queues (Redis + Horizon)
| Queue | Used for | Priority order |
|-------|----------|----------------|
| `standard` | merge/split/rotate fallbacks, light tasks | Pro > Trial > Guest |
| `conversion` | PDF↔Office fast mode | Pro > Trial > Guest |
| `high_accuracy` | High Accuracy Beta conversions | Pro > Trial > Guest |
| `ocr` | OCRmyPDF / Tesseract | Pro > Trial > Guest |
| `ai` | summary, translate | Pro > Trial > Guest |
| `cleanup` | temp-file deletion, TTL sweeps | always |

Priority is implemented with separate queue connections per tier so Horizon weights
`*-pro` before `*-trial` before `*-guest`. Failed jobs retry with backoff; each job has a
timeout; failures degrade gracefully to a friendly error + optional Rescue Mode retry.

## 4. Privacy & auto-delete
- Input + output live only in `storage/app/temp/{job_uuid}/` and are deleted after **1 hour**
  by the `cleanup` scheduler (and immediately via **Delete Now**).
- We persist **metadata only** (name, tool, size, status, credits, duration, format, coarse
  geo/device). We never keep the file or full extracted text. AI/OCR intermediate text is
  deleted at job cleanup.
- Raw IPs are **hashed**; geo is coarse (country from headers, city from optional free GeoIP).

## 5. Security
HTTPS only · CSRF on web routes · Sanctum for API · rate limiting (Redis) · email verification ·
hashed passwords · **signed, expiring** download URLs · per-job temp isolation · path-traversal
guards · MIME + extension + size + structure validation · zip-bomb guard on archive inputs ·
concurrent-job caps per user/IP · admin audit logs · secrets only in env (never committed).

## 6. Credits & plans (enforcement)
- One monthly wallet of **2100 credits** (`credits_ledger` is append-only; balance = sum).
- Annual plans still grant 2100/month (not upfront); unused credits expire monthly at reset.
- Every tool has a credit cost (range) in `tools`; heavy tasks show an **estimate before** run.
- Guest/Trial use **daily task limits** (rate-limit counters), Pro uses credits. All limits are
  admin-configurable (`feature_flags` + settings tables).

## 7. Feature flags (env + DB, admin-toggleable)
`ask_pdf_enabled=false`, `ads_enabled=false`, `secure_share_links_enabled=false`,
`apple_login_enabled=false`, `high_accuracy_enabled=true`, `translate_pdf_enabled=true`,
`ocr_enabled=true`, `scanner_enabled=true`.

## 8. Scaling notes (cost-controlled)
- Client-side first → fewer server cycles.
- One small VPS runs the whole stack initially; the Python worker is the first thing to scale
  horizontally (stateless, reads jobs from Redis).
- LibreOffice/OCR are CPU-heavy → cap worker concurrency; offload spikes to commercial API
  fallback via the provider interface when configured.
