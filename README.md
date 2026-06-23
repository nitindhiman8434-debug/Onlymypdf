# OnlyMyPDF — Fast, Private PDF Tools

> **Fast, private, powerful PDF tools** for work, study, and business.
> Convert, compress, merge, sign, scan, translate, and fix PDFs in seconds —
> with high-accuracy conversion, AI tools, and **1-hour auto-delete**.

OnlyMyPDF is a premium, colorful, privacy-first, **bilingual (English / हिन्दी)** PDF SaaS
for India and global users. This repository contains the full product foundation:
frontend, backend API, admin panel, and the heavy-processing worker layer.

---

## 🧭 Repository layout (monorepo)

```
onlymypdf/
├── frontend/        Next.js 14 (App Router) + TypeScript + Tailwind — public site, tools, dashboard
├── backend/         Laravel 11 API + Filament admin (/only-admin-panel) + queues + scheduler
├── worker/          Python Docker workers for OCR / conversion / heavy PDF jobs
├── infra/           nginx config, deployment helpers, cron
├── docs/            Architecture, database, API, design system, roadmap, deployment
├── docker-compose.yml
└── .env.example
```

Each app keeps its own README with deeper detail:
- [`frontend/README.md`](frontend/README.md)
- [`backend/README.md`](backend/README.md)
- [`worker/README.md`](worker/README.md)

## 📚 Documentation

| Doc | What's inside |
|-----|---------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, processing pipeline, queues, security |
| [docs/DATABASE.md](docs/DATABASE.md) | Every table, columns, relationships |
| [docs/API.md](docs/API.md) | REST endpoints, request/response shapes |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Colors, typography, components, logo, icons |
| [docs/CONVERSION_ENGINE.md](docs/CONVERSION_ENGINE.md) | The 5-layer high-accuracy conversion architecture |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase-by-phase build order and status |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hostinger VPS / Cloudflare deployment checklist |

## 🚀 Quick start (Docker, recommended)

> Built to run comfortably on a **₹10k–₹12k/month VPS** (4 vCPU / 8 GB RAM).

```bash
# 1. Clone & enter
git clone <repo> onlymypdf && cd onlymypdf

# 2. Create env files (one copy per app — see notes inside)
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env

# 3. Boot the stack (nextjs, laravel, mysql, redis, python-worker, nginx)
docker compose up -d --build

# 4. Backend: install, key, migrate, seed
docker compose exec laravel composer install
docker compose exec laravel php artisan key:generate
docker compose exec laravel php artisan migrate --seed

# 5. Start the queue workers (Horizon) + scheduler are auto-started by the container.
#    Visit:
#    - Web app:      http://localhost:3000
#    - API:          http://localhost:8000/api
#    - Admin panel:  http://localhost:8000/only-admin-panel
```

Default seeded admin (change immediately): `admin@onlymypdf.com` / `ChangeMe!2026`

## 🖥️ Local dev without Docker

```bash
# Frontend
cd frontend && npm install && npm run dev      # http://localhost:3000

# Backend
cd backend && composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve                              # http://localhost:8000
php artisan horizon                            # queues (separate terminal)
php artisan schedule:work                      # scheduler (separate terminal)

# Worker
cd worker && pip install -r requirements.txt && python worker.py
```

## 🧪 Tests

```bash
cd backend && php artisan test          # credits, limits, cleanup, rate limits, webhooks, admin
cd frontend && npm run test             # component + SEO metadata tests
cd frontend && npm run lint
```

## 🔑 Key product rules baked into the code

- **Privacy first** — server-side files auto-delete after **1 hour**; client-side tools never upload.
- **Credits** — single unified monthly wallet of **2100 credits** (costs in `tools` seed / admin).
- **Plans** — Guest Free · Free Pro Trial (30 days, no card) · Pro Paid (₹299/mo, ₹2499/yr, $9/mo, $79/yr).
- **No false accuracy claims** — High Accuracy *Beta* with quality scoring + fallback, never "100%".
- **Bilingual** — English default, Hindi under `/hi/` with English slugs (e.g. `/hi/compress-pdf`).
- **Admin** — Filament at a configurable path (`ADMIN_PATH`, default `/only-admin-panel`), English only.

See [docs/ROADMAP.md](docs/ROADMAP.md) for what is implemented now vs. planned per phase.

## 🏢 Company

**Only My PDF Limited** · support@onlymypdf.com · https://onlymypdf.com

## License

Proprietary © Only My PDF Limited. All rights reserved.
