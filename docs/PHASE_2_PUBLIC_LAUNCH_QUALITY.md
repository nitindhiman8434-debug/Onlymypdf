# Phase 2 Public Launch Quality Checkpoint

**Started:** 18 September 2026

**Branch:** `phase1-dependable-beta`

**Phase 2 overall completion:** 40%

**Current work package:** Phase 2.3 — semantic Office output and OCR

**Phase 2.2 status:** Complete. The confirmed publishable operator is `OnlyMyPDF`, India.

**Phase 2.3A status:** Implementation and local Linux container gate complete; Railway worker deployment verification pending.

## Scope and safety boundary

Phase 2 covers public-launch accessibility, legal/privacy evidence, semantic Office output improvements, OCR, requested PDF tools and verified customer feedback. Phase 2.1 deliberately changes navigation, forms, upload controls and accessibility tests only. It does not change conversion engines, file output, conversion timing, quality scoring, queueing or storage behavior.

Any later work that can change Word, Excel, PowerPoint or OCR output must be reviewed as a separate work package before implementation.

## Issues found and resolved in Phase 2.1

1. **Desktop All Tools menu trapped keyboard focus.** The non-modal menu no longer uses a modal focus trap. Tab can enter and leave the tool links, while Escape closes the menu and returns focus to the trigger.
2. **Mobile navigation had duplicate focus stops.** Header links no longer contain nested buttons. Each CTA is one semantic link, so focus order is predictable.
3. **The reusable upload dropzone was pointer-only.** It is now a semantic button with a visible focus ring, keyboard activation, descriptive help text and announced errors.
4. **The shared modal focus trap included elements with `tabindex="-1"`.** Focusable-node selection now excludes intentionally skipped and hidden controls, handles an empty dialog safely and restores the previous focus.
5. **Skip-link destination was not programmatically focusable.** The main content target now accepts focus without entering the normal Tab order.
6. **Password visibility controls were incomplete or removed from keyboard order.** Login and reset flows now expose 44-pixel keyboard controls, visible focus, accessible names and `aria-pressed` state.
7. **Auth fields lacked browser and assistive-technology metadata.** Login, signup, forgot-password and reset-password inputs now have stable names and appropriate `autocomplete` values. Email inputs disable spellcheck.
8. **Signup validation announced an error but did not move focus to the field needing correction.** Password, confirmation and terms validation now focus the relevant control.
9. **Cookie dismissal waited for the consent API before closing.** The dialog now closes immediately, restores focus and synchronizes consent in the background.
10. **Upload progress and decorative icons added noise.** Progress bars now have an accessible label, error text uses `role="alert"`, and touched decorative icons are hidden from assistive technology.
11. **Broad `transition-all` rules were used on shared controls.** Touched shared controls now transition only the properties they animate.

## Verification evidence

| Gate | Result | Evidence |
|---|---:|---|
| Keyboard regression suite | Pass | 7/7 Playwright tests |
| Skip link | Pass | Tab exposes the link; Enter focuses `#main-content` |
| Desktop tool menu | Pass | Enter opens; Tab enters and exits; Escape closes and restores focus |
| Mobile navigation | Pass | Dialog contains focus; Escape closes and restores focus |
| Tool upload chooser | Pass | Enter opens the real multiple-file chooser |
| Login password control | Pass | Correct autofill metadata, keyboard focus and pressed state |
| Signup validation focus | Pass | Invalid short password focuses the password field |
| Cookie dialog | Pass | Initial focus enters the dialog; Escape closes immediately |
| Serious/critical axe findings | Pass | 0 across 12 English/Hindi primary pages |
| Color contrast | Pass | 0 moderate-or-higher violations across 10 marketing/tool checks |
| Combined accessibility suite | Pass | 29/29 tests |
| TypeScript | Pass | `tsc --noEmit` |
| Touched-file ESLint | Pass | Zero errors or warnings |
| Production build | Pass | Next.js 16.3.5 webpack build; 154/154 static pages generated |

Automated evidence is not a substitute for a manual test with NVDA, JAWS, VoiceOver or another real screen reader. That manual review remains required before the full accessibility release gate can be marked complete.

## Phase 2 workstream status

| Workstream | Phase 2 weight | Complete | Status |
|---|---:|---:|---|
| Accessibility and inclusive UX | 20% | 12% | Keyboard foundation and automated primary-flow gate complete; real screen-reader review and wider tool sampling pending |
| Legal, privacy and public trust evidence | 20% | 0% | Pending legal review, subprocessors, security evidence and public status review |
| Semantic Office output and OCR | 35% | 0% | Pending separate approval because output behavior can change |
| Repair/OCR/PDF-A/Redact/Crop/Compare tools | 20% | 0% | Pending demand order and implementation |
| Verified customer feedback | 5% | 0% | Pending real consented customer evidence |
| **Total** | **100%** | **12%** | **Phase 2 started** |

## Next work package

Phase 2.2 should review legal/privacy consistency and publish verifiable public trust evidence: subprocessors, retention wording, security controls, incident/status communication and customer-facing claims. This is the next low-risk work package because it does not alter conversion output.

Semantic conversion and OCR work should begin only after its target formats, accuracy benchmark, cost ceiling and output-change approval are recorded.

## Phase 2.2 scope and safety boundary

Phase 2.2 aligns public policies and trust claims with implemented behavior. It covers legal copy, privacy disclosures, cookies, refunds, service status, public trust evidence, account deletion safety, and regression tests. It does not change a conversion engine, output file, layout, queue priority, quality score, or conversion timing.

## Issues found and resolved in Phase 2.2

1. **The privacy contact pointed to an unverified domain.** Policies and Dashboard settings now use one configurable public privacy email with the working support address as the fallback.
2. **Legal pages used different effective dates and repeated conflicting content.** English and Hindi Terms, Privacy, Cookie, Refund, Trust, and Service Level pages now use one dated legal configuration.
3. **Provider copy treated optional services as always active.** The Privacy policy now separates core infrastructure from processors that receive data only when their feature is enabled and used.
4. **Cloudflare R2 and Railway were missing from public disclosures.** The live conversion storage and worker architecture is now named beside Supabase and Upstash.
5. **AI copy made an unsupported training claim and hid the text transfer.** The policy and tool FAQ now state that up to 100,000 extracted characters go to Google Gemini when AI summarization is requested, while OnlyMyPDF logs usage metadata rather than extracted text.
6. **The Cookie policy did not inventory actual storage.** It now documents `pd_guest_session`, `pd_locale`, `pd_consent`, Supabase authentication cookies, and the five-minute `pd_step_up` cookie. It also states that the current application loads no analytics or advertising tag.
7. **The Trust Center could be read as a certification claim.** It now lists verified code controls, accuracy limits, signature limits, and the absence of SOC 2, ISO 27001, HIPAA, PCI DSS, or another independent product certification.
8. **Refund and support copy promised operational timing without measured evidence.** Refund review factors, payment-provider timing, cancellation effects, and non-contractual support targets are now explicit.
9. **The public Status page exposed deployment instructions.** It now shows customer-facing health, accurately labels the absence of public incident history, and directs blocked users to support.
10. **AI and signature marketing copy overstated privacy and legal acceptance.** Public copy now describes actual processing and distinguishes a visual signature from certificate-based signing.
11. **Account deletion could orphan a stored object after a storage failure.** Deletion is now fail-closed: account-linked files are removed before database rows and the account remain available for retry if any object deletion fails.
12. **Terms acceptance did not identify the new policy revision.** New acceptance records now use `tos-2026-09-18`.

## Phase 2.2 verification evidence

| Gate | Result | Evidence |
|---|---:|---|
| Legal/privacy unit suite | Pass | 18/18 tests across legal content, retention, consent routes, and account deletion |
| Public legal browser flows | Pass | 8/8 Playwright tests |
| Legal-page accessibility | Pass | 4/4 serious/critical axe checks, including Hindi Privacy |
| Legal-page color contrast | Pass | 3/3 Privacy, Cookie, and Trust checks |
| TypeScript | Pass | `tsc --noEmit` |
| Touched-file ESLint | Pass | Zero errors |
| Production build | Pass | Next.js 16.3.5 webpack build; 154/154 static pages generated |
| Visual browser review | Pass | Privacy, Trust Center, and live Status reviewed; zero browser warnings or errors |

## Phase 2.2 production identity

The user confirmed these publishable values on 18 September 2026:

- `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`: `OnlyMyPDF`
- `NEXT_PUBLIC_LEGAL_OPERATOR_COUNTRY`: `India`
- `NEXT_PUBLIC_PRIVACY_EMAIL`: the monitored address for privacy requests

The confirmed values match the code defaults. No production code change is required for the name or country. Independent legal review remains an external launch decision and is not a software test.

## Updated Phase 2 workstream status

| Workstream | Phase 2 weight | Complete | Status |
|---|---:|---:|---|
| Accessibility and inclusive UX | 20% | 12% | Automated keyboard and primary-flow gate complete; real screen-reader review pending |
| Legal, privacy and public trust evidence | 20% | 20% | Engineering gate and operator identity complete |
| Semantic Office output and OCR | 35% | 8% | Phase 2.3A PDF-to-Word OCR foundation passed; broader OCR and Excel/PowerPoint semantics pending |
| Repair/OCR/PDF-A/Redact/Crop/Compare tools | 20% | 0% | Pending demand order and implementation |
| Verified customer feedback | 5% | 0% | Pending real consented customer evidence |
| **Total** | **100%** | **40%** | **Phase 2.2 complete; Phase 2.3A local gate complete** |

Phase 2.3 PDF-to-Word and OCR output changes were approved on 18 September 2026. Its decision gate and evidence are recorded in `docs/PHASE_2_3_SEMANTIC_OFFICE_OCR.md`.
