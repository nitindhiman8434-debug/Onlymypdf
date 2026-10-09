# Phase 3.6: English launch-claims consistency

**Date:** 9 October 2026

**Status:** Complete for the scoped local checks. Public launch gates remain open.

## Scope

This is the bounded follow-up to Scanner evidence publication: compare active
English tool, marketing, pricing, privacy, trust, status and machine-readable
claims against source behavior and retained evidence, correct mismatches, and
refresh the launch checklist. It is a copy/presentation review, not a new
conversion benchmark, legal certification or production deployment.

## Findings and corrections

| Area | Incorrect or unsupported claim | Correction and evidence |
|---|---|---|
| File lifetime | All files deleted within exactly 2/24 hours; Pro downloads always last 24 hours | Account-file expiry is Free 2h/Pro 24h (`src/lib/privacy/retention.ts`), while Word jobs use a separate 2h lifetime and one-time result consumption (`pdf-to-word-jobs.service.ts`). Preview sessions can expire sooner. Expiry restricts access; cleanup/retry timing can delay physical deletion. |
| Security | All stored files encrypted at rest; local checks establish public TLS/security | Temporary PDF services write raw bytes to disk. Host/provider encryption and actual private bucket settings require deployment verification. Public HTTPS is required; loopback preview uses HTTP. |
| Providers | Upstash and Railway described as current core queue/worker infrastructure | Copy identifies supported integrations, default Supabase coordination, optional R2 and legacy provider roles. Listing a provider does not establish that it is active. |
| Status | Public `ok` interpreted as “All systems operational” | The public health response checks application/configuration only (`src/app/api/health/route.ts`). UI now says “Application responding” and explains excluded checks. SLA copy matches this boundary. |
| AI | Reads every page; instant output; Pro required; Free excluded in pricing | The provider receives up to the first 100,000 extracted characters (`src/lib/ai/gemini.ts`). Copy explains truncation/review and signed-in Free one-summary/day access. Pro has no separate daily AI-summary cap, subject to other limits and availability. |
| Paid features | Priority processing, generic batch jobs, guaranteed faster results | The Word queue has no plan-priority scheduling; these unsupported entitlements/timing promises were removed. File/tool-dependent processing replaces universal speed claims. |
| Checkout | Payment methods and Product `InStock` treated as always available | Billing supports disabled/mock/live modes (`billing-config.ts`). Copy is conditional on live checkout; unconditional availability metadata was removed. Configured prices and payment execution are unchanged. |
| Pricing discovery | Public plans were hidden behind client-side authentication initialization | The public pricing content now renders before the session check finishes. Account-dependent buttons stay disabled while loading; the existing signed-in dashboard redirect is retained. Business seats, payment terms and support are agreed through Sales rather than a fixed 20+ seat promise. |
| Image limits | JPG-to-PDF supports 50 images | Its API rejects more than 20 on every plan. Page, FAQ and SEO now match 20; Scanner stays at its separately verified cap of 10. |
| Compression and merge | Typical percentage savings, crisp Strong output, all bookmarks/links preserved | Strong compression can rasterize pages; savings/content changes require review. Merge copies pages into a new document and does not promise preservation of every document-level interactive structure. |
| TXT and HTML | No TXT characters lost; any HTML/URL becomes identical PDF | Standard-font sanitization can substitute unsupported characters. HTML accepts uploaded files and blocks scripts/external resources. Public copy now describes those restrictions. |
| Protection/signing | Permission passwords and printing restrictions; certificate-like signature assurance | Protect exposes one open password. Sign places a visual signature, not a certificate signature. |
| Processing location and capacity | Split entirely in browser; no Word page limit; every upload-cap-sized document processes | Split uploads to the API; OCR has a bounded processing gate. Upload caps are qualified by format, page/count and processing limits. |
| Site discovery | Machine guide used the wrong domain and repeated guarantees | Getting-started copy uses the configured app route; AEO, JSON-LD and shared FAQs receive the same corrections. |

The active home is the locked HomeLayoutB/v2-d1 variant. Unused design variants
are not counted as active public claims. Hindi content remains untouched.

## Verification

Final unit, lint, webpack-build, actual served-page and browser results are
recorded in `quality/phase3-launch-claims/verification-report.json`:

- 64/64 tests across 16 files passed, including three public-pricing initial-render cases.
- Touched-file ESLint: zero errors; seven pre-existing warnings remain.
- Final webpack production build and TypeScript passed; 170/170 entries generated.
- 42/42 loopback URLs passed all 308 content/metadata assertions. Eight parser self-tests passed separately.
- Home, Pricing and Trust passed nine width checks at requested 390, 768 and 1280 pixels, with no horizontal overflow. Screenshots were reviewed inline.
- Four FAQ questions were opened to verify AI, Scanner, retention and encryption answers. The restored local status page showed “Application responding” with its scope disclaimer.
- The local preview was restored at `http://127.0.0.1:3001/pricing`; final Free AI allowance and Business terms were visible. The temporary port-3002 verification server was stopped.

The loopback HTTP checker reads 28 tool routes, twelve marketing/legal/hub routes and the
two machine-readable guides. It checks actual HTML/JSON-LD rather than counting
strings that occur only inside React payloads. Hydrated status and collapsed
FAQ interactions require separate browser checks.

The code comparison confirmed that Hindi bundles/legal branches and
conversion, API, queue, storage, billing execution and dependencies remain
unchanged. The only behavior change is public pricing rendering while session
initialization is pending, with disabled account-dependent actions. Existing
engine evidence is retained, not re-measured in this task.

The first HTTP attempt completed 24 routes before its 180-second overall
budget expired. The retained initial report is not counted as a pass. The
final bounded 600-second run includes per-response timing and a safe parser
prefilter; all 42 responses completed. The initial timeout's cause was not
established, and these timings are not production performance benchmarks.
The final build retains existing custom cache-header, middleware-convention
and legacy Buffer warnings. Local dev's initial `/status` compilation took
26 seconds and outlasted one browser navigation call; the completed page and
its health label were subsequently verified.

## Launch checklist and remaining gates

`docs/PRODUCTION_CHECKLIST.md` now separates completed local preparation from
public HTTPS artifact checks, representative load and per-tool capacity,
deployed cleanup/retry, actual provider cost, five real consented customers and
operator legal/commercial decisions. The migration inventory includes 022–024;
operators must verify applied state before running any migration.

Detailed health's aggregate result does not by itself prove cleanup works.
Inspect individual cleanup records and real objects during deployment testing.
The local preview's simplified authentication and limits must not be exposed
publicly. No paid resource, cloud setting, migration or deployment was changed.

Completion of this copy audit does not close the deferred Phase 2 production
and real-customer gates or establish universal accuracy, capacity, uptime,
security certification or search ranking.
