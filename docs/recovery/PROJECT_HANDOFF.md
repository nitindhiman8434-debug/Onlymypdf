# OnlyMyPDF: continuation handoff

Recovered: 2026-09-17. Purpose: continue an existing project after an imported chat exceeded Codex's context window. This is a continuity record, not a production-readiness audit or a code backup.

## Start here

- Working project: `C:\Users\NiTiN Dhiman\Documents\Cursor\pdf-doctor`.
- Parent workspace: `C:\Users\NiTiN Dhiman\Documents\Cursor`.
- Product name in current source: **OnlyMyPDF**. The package/folder still use `pdf-doctor`; older records also say PDF Doctor and Only4PDF.
- Another folder named `S1` exists in the parent workspace. Do not switch to it, restore a snapshot, or replace the working project just because an old message mentions S1.
- Current user wants a simple way to carry existing work and decisions into this connected chat. Recovery does not authorize executing the whole historic backlog, purchasing services, deploying, or rewriting the app.
- Read this handoff first; consult only relevant source files and matching historical requests next.

## What was recovered, and its limits

The task reader returned 98 pages covering all 978 imported conversation turns and the subsequent failed Codex turn. The last page returned hasMore=false. The failure reports: "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying."

`IMPORTED_CHAT_REQUESTS.md` contains 878 filtered, nonempty historical text entries, indexed as T1 through T978 (gaps are omitted automatic/empty entries). The complete original initial brief is retained at T1. User wording is quoted as history, not as fresh instructions. Most recent requirements and selected past outcomes were compared with a limited read-only source inspection.

This recovery is NOT a claim that every old screenshot was viewed, every tool output was preserved, every line of code was audited, or every old request was fulfilled. Attachments were referenced in the imported history but their image/file contents were not collected or validated here. Other sibling tasks/chats were not exhaustively read. When a request says only "remove the red-marked point", recover its original image before inferring what it means.

## User preferences and scope boundaries

- Explain in simple Hinglish, with short concrete steps; the user describes themself as a beginner (T1).
- Continue existing work; preserve approved design, images, layout, and working behavior. Do not restart from a blank project.
- Strong recurring boundary: do not change conversion pipelines during security, performance, SEO, UI, or infrastructure work. T972/T974/T976 repeat this. If an issue requires a pipeline change outside the current authorized task, identify it rather than silently rewriting the engine. Specific conversion bug requests are narrower exceptions, not blanket permission for unrelated refactors.
- Some earlier remediation phases explicitly requested one task at a time and reporting completion before the next (T692/T703/T710). Apply these within their context; do not invent additional approval requirements for an already authorized task.
- Latest payment context: user said they do not yet have a payment gateway to connect (T972). Payment code exists, but live billing setup/testing is not assumed complete.
- "A1" means a comprehensive, evidence-based audit across the site, accounts, backend, security, production/enterprise readiness, with ratings (T700/T701). Do not run A1 merely because its name appears in history.
- "S1" and "S1 a" were historical backup requests (e.g. T677/T800). A recovery summary is not a backup of source, images, database, or secrets. Do not run revert scripts or claim a restorable backup without verifying it.
- Past requests for high audit scores are goals, not evidence of safety or correctness. Report test limitations and external configuration gaps honestly.

## Product and requirement map

| Area | Recovered requirements and later decisions | Evidence |
|---|---|---|
| Product | A real PDF toolkit SaaS, original design inspired by Smallpdf/iLovePDF usability, beginner-friendly operation; future mobile/API-friendly architecture | T1 |
| Core tools | Merge, split, compress, PDF/Word conversions, JPG-to-PDF, sign, scanner, protect/unlock, AI summaries | T1 |
| Added tools | PDF/Excel, Excel/PDF, PDF/PowerPoint, PowerPoint/PDF, watermark, rotate, delete, extract pages, HTML/PDF, TXT/PDF | T53–54, T206, T215–216, T229, T234 |
| Conversion fidelity | Preserve page orientation, text, tables, images, numbers, layout, bullets and watermarks; editable Word/PowerPoint output where requested; no missing content; compare original and converted artifacts | T128–164, T180–205, T429–469, T927–946, T955–964 |
| Performance | Fast conversions for supported large files; meaningful progress; no indefinite 92/98/99 percent stalls; preserve output quality while improving speed | T396–425, T898–913, T939–941, T954, T959, T977–978 |
| Language | English default plus Hindi; later requests extend Hindi to FAQs, error messages, legal and tool UI | T1, T566–568, T633–637, T733–759 |
| Upload limits | Earlier unlimited-size wishes were later superseded by explicit 25 MB Free / 200 MB Pro messaging and enforcement work; remove misleading unlimited-file-size claims | T167–168, T676, T703, T743–747, T908 |
| Branding | OnlyMyPDF replaces PDF Doctor/Only4PDF; preserve approved layout and use supplied logo assets; later new-logo replacement must preserve size/position, with transparent background/favicon/social image | T596, T839–840, T914–918 |
| Pricing | Free/Pro and Business section; display currency selector INR/USD/EUR, display-only conversions with INR checkout; requested USD 4 and EUR 4 monthly display, USD default; homepage consistency | T682–684, T920–925 |
| Billing | Razorpay architecture and mock/dev support; latest user lacks gateway; avoid treating payment integration code as proof of live setup | T1, T693, T710, T730, T972 |
| Dashboard | Recent jobs, usage and AI counts update after each action; clear expired-file state; correct login/logout visibility and user state | T600–604, T645, T652–654 |
| Privacy/security | Upload validation, limits, auto-delete after two hours, safe errors, CSRF, MFA/reauth, rate limiting, payment binding, organization authorization, cleanup and audits | T1, T544–585, T764–829, T965–976 |
| UI | Compact professional spacing/buttons, responsive tool workspaces, readable previews, correct page aspect ratio, result preview plus file size/download; preserve unrelated sections when modifying one feature | T59–64, T89–124, T223–227, T279–328, T373–395 |
| External pickers | Later explicit request removes Google Drive/Dropbox buttons and reclaims their space; earlier request to add them is superseded | T89 versus T353/T665 |
| Selection/passwords | Split/extract selection defaults unchecked; per-position insertion; correct password allows continuation, incorrect password errors; cancel excludes the locked file without trapping user in popup loop | T354/T360, T367, T855–875, T879–891, T952 |
| AI summaries | Keep the AI feature; professional sections, per-section copy/listen, PDF/Word/TXT exports | T39–52 |
| OCR copy | Remove only the sentence "For scanned PDFs, OCR will be used to extract text." while preserving other required messaging; this is not an instruction to disable OCR | T948 |

The archive contains finer UI revisions and reversals. It remains the reference for exact wording. Never automatically reapply an old change that was undone later.

## Current source observations (read-only, not runtime validation)

| Observation | Local source evidence |
|---|---|
| OnlyMyPDF name | src/config/constants.ts APP_NAME and README.md |
| Theme A + Layout B locked | src/config/design-system.ts: DESIGN_LOCKED=true, Enterprise Navy, split panel |
| V2 hero animation D1 locked | src/config/hero-variant.ts: HERO_VARIANT_LOCKED=true |
| Logo D wiring | src/config/brand.ts and src/config/brand-logos.ts; preserve current asset bytes, since T839–840 replaced logo imagery after the earlier D selection |
| Current package versions | package.json: Next.js 16.3.5, React 19.2.4, Tailwind 4; README/PROJECT_PLAN still say Next.js 14, so they are not authoritative version references |
| File-limit defaults | src/config/constants.ts defaults: Free 25 MB, Pro 200 MB, two-hour retention. Private environment values and admin/database overrides were not read |
| Daily-use constants | src/config/constants.ts includes Free=5 and Pro=100. Earlier brief says unlimited Pro; actual effective enforcement was not traced. Verify product copy/enforcement before making claims |
| INR pricing defaults | src/config/constants.ts: Pro monthly 299, yearly 2399; team per-seat monthly 249, yearly 1999. These are source defaults, not verified live prices |
| Display currency | src/lib/pricing/display-currency.ts fixes USD/EUR monthly=4 and yearly=32, says checkout INR; use-display-currency.ts begins with USD then uses stored/inferred preference. T923's default-USD request needs browser verification across locales |
| Application breadth | Source includes public/legal pages, auth, dashboard/settings/security/files/enterprise, admin, PDF tool pages, backend routes, Supabase migrations, unit and E2E tests |
| Migration files | 001 through 020 exist; remote database application status is unknown |
| Compression change exists | pdf-compress.service.ts contains adaptive raster plan, Strong raster attempts, Basic fallback raster and smallest-output selection; API maxDuration=300; pdf-compress.service.test.ts exists |
| Existing documents | README.md, PROJECT_PLAN.md, DEPLOYMENT_GUIDE.md, docs/OPERATIONS.md, docs/TESTING.md, docs/PRODUCTION_CHECKLIST.md, docs/PDF_TO_WORD_PRODUCTION.md, S1-SNAPSHOT.md, S1-A-SNAPSHOT.md |

The README describes the product as production-ready, but that label was not validated. Its setup section mentions migrations only through 007, while current files go through 020. The production checklist viewed lists through 015. Reconcile documentation against source before following deployment instructions.

## Recent work and next verification priorities

### 1. Compression: most recent user-reported problem

T977: conversion appeared stuck at 92 percent. T978: after that hang changed, Basic and Strong previews predicted different sizes but downloaded output stayed the original size.

The old assistant's final T978 response says it changed compression to adaptive raster passes and raised timeout to five minutes. Matching service/test code is present. There is no later user confirmation in the recovered imported chat. Status: **fix reported and matching code present; real-file result not re-tested here**.

Next appropriate feature validation: reproduce with the original problem PDF if available, compare original/downloaded byte counts for Basic/Strong, check rendering/readability/text behavior and honest estimates. Current code deliberately returns the original when no smaller valid candidate exists; equal size alone does not establish the cause. Do not claim all PDFs must shrink or that raster compression preserves all original semantics.

### 2. PowerPoint editability: requirement not proven satisfied

T955–964 repeatedly request accurate PDF-to-PPT output with editable page text. The T964 assistant response describes preserving a slide picture, storing editable text in Notes and an off-slide textbox. That is not proof that visible slide text is editable in place as the user requested. Status: **potential requirement gap**, verify the actual output and clarify the desired editing behavior before treating this complete. No PPT artifact was opened during this recovery.

### 3. PDF-to-Word accuracy and latency

T927 compares an infographic against a reference converter; T934 and T945 report missing text/images in other PDFs; T946 requests hybrid/scanned detection/routing. T932 asks for lightweight CI and ConvertAPI-primary production planning. Source contains engine orchestration, ConvertAPI/pdf2docx/Word COM/LibreOffice/visual/node services and quality tests. Presence is not proof of fidelity. Compare artifacts for representative cases when that task is resumed; do not silently replace existing pipelines.

### 4. Security work and external setup

T976 assistant reports High/Medium changes and says migrations 019 and 020 must be applied to Supabase. It reports typecheck clean and 567 tests passed; these are **historical claims, not newly executed checks**. Migration files exist, but live DB state was not checked. Old replies also mention a bundled tar dependency risk and a previously shared Gemini key; current vulnerability/rotation status is unverified. Never copy credentials from history into documentation.

### 5. UI decisions needing evidence rather than inference

- T250–251 asked to remove Edit PDF; current code/config still contains it and later history references it. Public visibility and later intent were not fully traced. Do not delete it automatically.
- T924 says remove an image-marked point without naming it. T896 is similarly image-dependent. Do not invent their meaning from text alone.
- T912 undoes an earlier progress change. Check subsequent changes/current behavior rather than simply replaying T910.

## How to continue without recreating the context overflow

1. Read this file and the current user's specific task.
2. Search IMPORTED_CHAT_REQUESTS.md for that feature/decision; read the few relevant T entries, including later corrections.
3. If text depends on an image or an old response, use the source task ID and turn context to recover it; ask for a missing asset only if it cannot be accessed.
4. Inspect the matching source files. Follow AGENTS.md, including installed Next.js docs before code edits.
5. Make the authorized focused change, then validate relevant behavior. Record actual checks and unresolved dependencies distinctly.
6. Keep a concise continuation note after substantial future work; do not inject the entire 978-turn transcript into every task.

## Recovery validation and actions taken

- Confirmed pagination ended, original brief T1 and latest user message T978 were present, and source files were accessible.
- Created documentation only. No app source, environment file, database, conversion engine, account, remote repository or deployment was changed.
- No app build, conversion benchmark, vulnerability scan or full test suite was run for this documentation recovery.
- A read-only git-status attempt was blocked by Git's ownership check for the sandbox user; no global safe-directory configuration was changed. Git cleanliness/backup status is therefore not asserted.
- This handoff and request archive preserve continuation context; they do not repair the failed old conversation or constitute a full project backup.
