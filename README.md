# OnlyMyPDF

**Every PDF tool you need, in one simple place.**

OnlyMyPDF is a dependable-beta SaaS PDF toolkit. Merge, split, compress, convert, scan, sign, edit, protect, unlock, and summarize PDFs — all from your browser. Public production launch still requires the live activation gates in `docs/PRODUCTION_CHECKLIST.md`.

## Features

### PDF Tools
- **Merge PDF** — Combine multiple PDFs into one
- **Split PDF** — Split PDF into separate pages
- **Compress PDF** — Reduce PDF file size
- **PDF to Word** — Convert PDF to editable Word document
- **Word to PDF** — Convert Word documents to PDF
- **Edit PDF** — Add text and whiteout edits to pages
- **Sign PDF** — Add your signature to any PDF
- **AI PDF Summarizer** — Get AI-powered summary with key points
- **PDF Scanner** — Scan documents using your camera
- **Unlock PDF** — Remove password from PDFs you own
- **Protect PDF** — Add password protection to PDFs

### Business Features
- Free and Pro subscription plans
- Razorpay payment integration (UPI, Cards, Net Banking)
- Admin dashboard with analytics
- User management and role-based access
- Usage tracking and limits
- File auto-deletion after 2 hours

### Production Hardening
- Distributed rate limits (Upstash Redis) — fail-closed in production
- Atomic payment fulfillment (migration `007_payment_processing_status.sql`)
- PDF→Word async jobs stored in Redis + Supabase Storage (multi-instance safe)
- CSRF origin checks on auth and payment mutations
- GDPR consent sync for logged-in users

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| PDF Processing | pdf-lib, LibreOffice, ConvertAPI, pdf2docx |
| AI | Google Gemini API |
| Payments | Razorpay |
| Deployment | Vercel (app) + optional Docker (standalone) |

## Quick Start

### Prerequisites
- Node.js 20+ installed
- npm installed
- Supabase account
- Razorpay account (for payments)
- Upstash Redis (required for production rate limits and PDF→Word jobs)
- Gemini API key (for AI features)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/pdf-doctor.git
cd pdf-doctor
npm install
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

### Database migrations

Run all files in `supabase/migrations/` in order (001 through **021**) in the Supabase SQL Editor.

### Production readiness

Before deploying:

1. Set `PRODUCTION_URL`, `CRON_SECRET`, `HEALTH_CHECK_SECRET`, Upstash, and Supabase secrets
2. Run migrations through **021** and keep the `pdf-files` bucket private
3. Deploy the isolated `Dockerfile.worker` image and verify its heartbeat
4. Verify authenticated `/api/health` returns `healthy` (not `degraded`)
4. See `docs/OPERATIONS.md` and `PRODUCTION_CHECKLIST.md`

**Note:** The Vercel app sends large PDF→Word uploads directly to private Supabase storage. Run `Dockerfile.worker` on a container host for LibreOffice/pdf2docx conversion, or configure ConvertAPI.

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run typecheck    # TypeScript check
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E
make ci              # Full CI pipeline locally
```

## License

Proprietary — All rights reserved.
