# OnlyMyPDF — Frontend (Next.js)

Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · lightweight i18n.

## Run
```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run build && npm run start
npm run test       # vitest (SEO + tool-registry tests)
```

## Structure
```
app/                 routes (English at root, Hindi mirror under /hi/)
  page.tsx           homepage (en)         hi/page.tsx          homepage (hi)
  [slug]/page.tsx    tool pages (en)       hi/[slug]/page.tsx   tool pages (hi)
  tools, pricing, ai-tools, security, support, login, dashboard, legal/[slug]
  sitemap.ts, robots.ts
components/
  brand/Logo.tsx          inline-SVG logo (hidden medical "+")
  ui/                     shadcn-style primitives (Button, Badge, Card)
  icons/ToolIcon.tsx      colorful 3D-style tool tiles
  home/Hero.tsx           two hero modes (3D View | Product Demo) + live toggle
  tools/                  UploadBox, ProcessingView, ResultView, ToolWorkspace
  pages/                  shared page components used by en + hi routes
lib/
  tools.ts                tool registry (mirrors backend `tools` table)
  i18n.ts + messages/     en/hi catalogs, /hi routing helpers
  seo.ts                  metadata, hreflang, schema.org JSON-LD
  legal.ts                legal page drafts
  pdf/client.ts           in-browser PDF helpers (merge/rotate/extract/images→pdf)
```

## Key conventions
- **English default at `/`, Hindi under `/hi/`** with the *same English slugs*
  (`/compress-pdf` ↔ `/hi/compress-pdf`). See `lib/i18n.ts`.
- Heavy PDF libs are **dynamically imported** in `lib/pdf/client.ts` (per-tool, not global).
- All decorative motion respects `prefers-reduced-motion`.
- No upload box on the homepage — uploads live on individual tool pages only.
- The processing flow in `ToolWorkspace` is a front-end simulation until the API is wired
  in Phase 2/3 (client tools → browser; server tools → `/jobs/*` polling).
