# Phase 3.6 local verification

Checked 9 October 2026. This is an English publication-consistency review and a
public-pricing rendering fix, not a fresh conversion benchmark or deployment.

| Check | Result | Evidence |
|---|---|---|
| Focused unit/regression tests | 64/64 across 16 files | `unit-report.json` |
| TypeScript and webpack build | Passed; 170/170 entries | `build.log` |
| Touched-file ESLint | Zero errors; seven existing warnings | `lint.log` |
| Actual HTTP content and metadata | 42/42 routes; 308/308 assertions | `http-report.json` |
| Response-parser self-tests | 8/8; no network requests | `http-report.json` |
| Browser width checks | Nine checks without horizontal overflow | `verification-report.json` |
| FAQ/status/pricing UI | Reviewed in browser | `verification-report.json` |

The HTTP manifest contains 28 tool pages, twelve marketing/legal/hub pages and
two machine guides. Assertions inspect actual resolved HTML, metadata and
JSON-LD, not React payload strings. Responses have body sizes and SHA-256 hashes.
Scanner's five successful cases, six rejection checks, fourteen output/rendered
pages and six historical Dataset records remain separate and unchanged.

The first HTTP run passed 24 routes before its 180-second budget expired; its
failed final status is retained in `http-initial-report.json`. The final run uses
a fixed ten-minute total budget, 15 seconds per request and a 5 MiB body cap,
with no redirects, uploads, response-script execution or external URLs. The
initial timeout cause was not established. Timings are diagnostic, not a
production-speed claim.

Re-run the read-only checker against an existing local production build with:

```powershell
node scripts/phase3-launch-claims-check.mjs --self-test
node scripts/phase3-launch-claims-check.mjs
```

It defaults to `http://127.0.0.1:3002`; `LAUNCH_CLAIMS_BASE_URL` may select another
loopback HTTP origin. A dev server does not satisfy the production check.
The test build used placeholder authentication configuration, disabled billing
and external-service credentials, and no paid resources. The temporary build
server was stopped after checking; the usual offline preview was restored on
port 3001.

Browser review used requested widths 390, 768 and 1280 with height 844. The
scrollbar left client widths 382, 760 and 1272; document width matched each.
Screenshots were reviewed inline, not archived. Viewport emulation does not
certify physical devices. API, engine, queue, storage and payment execution,
dependencies, Hindi content and secrets were not changed. Public deployment,
cleanup/load/cost evidence, actual customers and operator decisions remain open.
