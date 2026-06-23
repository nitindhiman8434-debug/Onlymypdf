# OnlyMyPDF — Deployment Guide (Hostinger VPS + Cloudflare)

Target: a single **₹10k–₹12k/month** VPS (≈4 vCPU / 8 GB RAM / 100+ GB SSD). Scale the Python
worker out first when load grows.

## 1. Provision
1. Hostinger VPS (Ubuntu 24.04). Create a non-root sudo user.
2. Point `onlymypdf.com` + `www` DNS to the VPS via **Cloudflare** (proxied / orange cloud).
3. Cloudflare: SSL = Full (strict), enable WAF basics, caching for static assets, rate-limit rules.

## 2. Install
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER   # re-login
git clone <repo> /opt/onlymypdf && cd /opt/onlymypdf
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# edit the three env files (DB passwords, APP_KEY later, Razorpay/PayPal keys, mail, Google OAuth)
```

## 3. Boot
```bash
docker compose up -d --build
docker compose exec laravel composer install --no-dev --optimize-autoloader
docker compose exec laravel php artisan key:generate
docker compose exec laravel php artisan migrate --seed --force
docker compose exec laravel php artisan storage:link
docker compose exec laravel php artisan config:cache route:cache
```
Horizon + scheduler containers start automatically (see `docker-compose.yml`).

## 4. TLS
With Cloudflare proxy you can use a Cloudflare Origin Certificate on nginx, or run certbot.
nginx config: `infra/nginx/default.conf` (proxies `/api` + admin to Laravel, the rest to Next.js).

## 5. Scheduler / cron
The `scheduler` container runs `php artisan schedule:work`. It triggers:
- `temp:cleanup` (every minute) — deletes job temp dirs past their 1-hour TTL.
- `credits:reset` (hourly) — monthly credit grant/expiry on billing cycle.
- `trials:expire` (hourly) — downgrade expired trials to Free, send reminders.
- `db:backup` (daily) — mysqldump to `/opt/onlymypdf/backups` (rotate 7 days).

If not using the container, add to host crontab:
```
* * * * * cd /opt/onlymypdf && docker compose exec -T laravel php artisan schedule:run >> /dev/null 2>&1
```

## 6. Monitoring (low cost)
- **Errors**: Sentry DSN in env (frontend + backend), or self-hosted GlitchTip.
- **Uptime**: UptimeRobot (free) on `/` and `/api/health`.
- **Queues**: Horizon dashboard (`/horizon`, admin-protected).
- **Disk / temp**: cron alert if `storage/app/temp` or disk > 80% (script in `infra/`).
- **Logs**: Docker `json-file` with `max-size`/`max-file` rotation (set in compose for prod).

## 7. VPS deployment checklist
- [ ] Strong DB + admin passwords; `ADMIN_PATH` changed from default
- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] HTTPS enforced (Cloudflare Full strict)
- [ ] Razorpay + PayPal live keys + webhook secrets set; webhooks reachable
- [ ] Google OAuth credentials + verified domain
- [ ] Mail (transactional) configured; SPF/DKIM/DMARC for onlymypdf.com
- [ ] `config:cache route:cache view:cache` after deploy
- [ ] Daily DB backup verified + off-box copy
- [ ] Horizon supervised (auto-restart) and scaled to CPU
- [ ] Temp-cleanup confirmed running (upload, wait, verify deletion at 1h)
- [ ] Sentry + UptimeRobot live
- [ ] Worker concurrency tuned to vCPU; commercial API fallback keys (if used) set

## 8. Scaling path
1. Increase `WORKER_CONCURRENCY` / add a second worker container.
2. Move worker(s) to a separate VPS reading the same Redis.
3. Managed MySQL + Redis when revenue supports it.
4. Object storage (S3-compatible) for temp files if multi-node (still 1-hour TTL).
