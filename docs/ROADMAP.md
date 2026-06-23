# OnlyMyPDF — Build Roadmap & Status

Legend: ✅ implemented in this foundation · 🟡 scaffolded (structure + stubs) · ⬜ planned

## Phase 0 — Architecture ✅
- ✅ Monorepo, docker-compose, env examples, nginx
- ✅ Docs: ARCHITECTURE, DATABASE, API, DESIGN_SYSTEM, CONVERSION_ENGINE, DEPLOYMENT, ROADMAP

## Phase 1 — UI prototype (Next.js)
- ✅ Design system (Tailwind theme, tokens, globals), inline SVG logo, brand
- ✅ i18n scaffolding (en/hi catalogs, `/hi/` routing helper)
- ✅ Homepage: header, nav, EN|हिन्दी + Login + Pro CTA, hero (both animation modes + toggle),
  smart search, popular quick cards, full tools grid
- ✅ Tools grid + tool registry (all launch tools, categories, badges, credit costs)
- ✅ Representative tool page (Compress) with upload box, options, privacy, FAQ, SEO, related
- ✅ Processing page component (7 states + colorful quality meter) and result page component
- ✅ Pricing page (Guest/Trial/Pro, INR+USD, 2100 credits wording)
- 🟡 Login/signup, dashboard, support/contact, legal pages (routes + layouts present, wiring to
  API in Phase 2)
- 🟡 Admin panel preview (Filament lives in backend; see backend README)

## Phase 2 — Backend foundation (Laravel)
- ✅ Migrations for every entity in DATABASE.md
- ✅ Seeders: plans, tools (+credit costs +file limits), admin user, feature flags, legal drafts
- 🟡 Models, auth (email + Google + verification), credits service, rate-limit middleware,
  feature-flag service, API controllers, Filament resources
- ⬜ Full payments wiring, full admin coverage

## Phase 3 — Processing architecture
- ✅ Worker scaffold (Python) with provider abstraction + registry + smart detection stub
- 🟡 Job model + queues + temp storage + cleanup scheduler + signed downloads + Delete Now
- ⬜ SSE/WebSocket status (polling implemented first)

## Phase 4 — Core tools
- 🟡 Client-side foundation (pdf-lib/PDF.js helpers): Reader, Merge, Split, Rotate, Delete/Extract,
  Organize, JPG→PDF, simple Sign/Watermark/Protect/Unlock
- ⬜ Compress, PDF→JPG server paths

## Phase 5 — High Accuracy Beta tools
- ⬜ PDF→Word, PDF→Excel, OCR, Translate, Extract Tables (architecture ✅ in CONVERSION_ENGINE.md)

## Phase 6 — AI summary
- ⬜ Extraction, chunking, summary output, credit usage, safety limits (provider interface 🟡)

## Phase 7 — Payments & subscriptions
- ⬜ Razorpay, PayPal, invoices (GST), trial expiry, downgrade/upgrade (schema ✅)

## Phase 8 — SEO, Hindi, legal, deploy, tests, perf
- 🟡 SEO metadata helpers, sitemap/robots, hreflang/canonical, schema.org
- ⬜ Full Hindi catalog, legal page bodies, perf pass, full test suite

> This file is the single source of truth for "what's done". Update it as phases land so no
> requirement is silently dropped.
