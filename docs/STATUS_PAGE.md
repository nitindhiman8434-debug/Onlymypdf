# External status page setup

OnlyMyPDF exposes:

| Surface | Purpose |
|---------|---------|
| `GET /api/health` | Monitor target (200 = liveness; `degraded` in production if Supabase coordination is missing) |
| `/status` | Public page with live health badge + link to external status |
| Footer **System status** | Links to external URL when configured, else `/status` |

## Recommended providers

### Better Stack (Better Uptime)

1. Create an uptime monitor → URL `https://yourdomain.com/api/health`
2. Create a public status page in Better Stack → copy the public URL
3. Set in production:

```env
NEXT_PUBLIC_STATUS_PAGE_URL=https://status.onlymypdf.com
```

4. Optional: add monitors for `/`, `/robots.txt`, and authenticated detailed health:

```bash
curl -fsS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" https://yourdomain.com/api/health
```

### Instatus

1. Add component → HTTP monitor on `/api/health`
2. Publish status page → set `NEXT_PUBLIC_STATUS_PAGE_URL` to the Instatus public URL

## Internal-only (no external provider)

Omit `NEXT_PUBLIC_STATUS_PAGE_URL`. Users see `/status` with a live poll of `/api/health`.

## CI smoke

Post-deploy smoke (`.github/workflows/deploy-smoke.yml` and `cd.yml`) hits `/api/health` automatically when `PRODUCTION_URL` is set.
