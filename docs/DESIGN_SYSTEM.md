# OnlyMyPDF — Design System

Premium · professional · vibrant · light/white modern · privacy-first · subtly medical-trust
(not hospital-like). Mixed visual style: **colorful 3D-style icons** on tool cards, **clean flat
icons** for nav/UI.

## Color tokens
| Token | Hex | Use |
|-------|-----|-----|
| `navy` | `#07111F` | text, dark sections, footer |
| `teal` | `#16D6C5` | medical-trust accent, success-ish |
| `blue` | `#2563EB` | primary brand / links |
| `green` | `#22C55E` | healing/positive, privacy badges |
| `violet`| `#8B5CF6` | AI accents |
| `coral` | `#FF5A5F` | primary CTA |
| `bg` | `#F8FAFC` | soft background |
| `card`| `#FFFFFF` | white cards |

Gradients used sparingly (hero blobs, AI badges). **Default interface and hero are white/light.**

These map to CSS variables + Tailwind theme extension in `frontend/tailwind.config.ts` and
`frontend/app/globals.css`.

## Typography
- UI font: **Inter** (Latin) with **Noto Sans Devanagari** fallback for natural Hindi.
- Headings: tight tracking, semibold/bold; generous line-height; never cramped.
- Base 16px; fluid clamp() for hero headline.

## Logo
- Inline **SVG** only (no external image deps) — see
  `frontend/components/brand/Logo.tsx`.
- Icon = modern document/page with a folded corner; a **subtle medical “+”** hidden inside the
  page using low-contrast strokes (premium, not hospital). Wordmark text exactly: **OnlyMyPDF**
  (“Only” navy, “My” blue, “PDF” coral, or a single gradient — both provided).
- Light + dark variants via `currentColor` + a `variant` prop.

## Icons
- Tool-card icons: colorful, soft 3D feel (gradient fill + subtle inner shadow + consistent
  16px radius). Implemented as small inline SVG components in `components/icons/tools/`.
- Nav/UI icons: flat line icons (lucide-react), 1.75 stroke, currentColor.
- Consistent radius, lighting direction (top-left), and the palette above.

## Components (shadcn-style, in `components/ui/`)
Button (variants: primary/coral, secondary/outline, ghost, brand-gradient), Badge (with
`accuracy`, `ai`, `privacy` styles), Card, Input, Dropdown, Tabs/Toggle, Tooltip, Dialog,
Progress (the colorful processing meter), Toast, Switch (EN|हिन्दी and 3D|Demo toggles).

## Badges
- **High Accuracy Beta** — violet/blue gradient, on PDF→Word, PDF→Excel, OCR, Translate.
- **AI** — violet sparkle, on AI Summarizer, Translate, future Ask PDF.
- **Privacy** — green, "1-hour auto-delete" / "Processed in your browser".

## Motion
- Framer Motion, lazy-loaded. All decorative motion gated behind `prefers-reduced-motion`.
- Hero has two modes with a live toggle: **3D View** (floating PDF objects, lock, AI sparkle)
  and **Product Demo** (upload→processing→quality→download mock with progress + auto-delete +
  High Accuracy Beta badges).

## Accessibility
Keyboard reachable, visible focus rings, ARIA labels on uploads/toggles, AA contrast, reduced
motion, screen-reader-friendly file inputs, clear inline errors.
