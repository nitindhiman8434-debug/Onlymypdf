# Phase 2 verified customer feedback

**Started:** 24 September 2026

**Engineering status:** Complete in code

**Real-customer evidence:** 0/5

**Phase 2 contribution:** 0% until real consented customer submissions exist

## What is implemented

- Authenticated customers can open `/dashboard/feedback` and choose one of their own completed conversion jobs.
- Overall result, accuracy and speed are rated from 1 to 5. A 20–2,000 character comment is required.
- Consent to store feedback for product-quality research is required. Permission to publish the comment is a separate optional choice.
- A submission starts as `pending`. Nothing is published automatically, including a comment with publication permission.
- The feedback record stores the tool/job link, ratings, comment, consent version, publication choice, moderation status and timestamps. It does not copy the file name, document contents, customer name or email.
- Customers can withdraw and permanently delete their own feedback from the same page.
- Feedback is included in the user's GDPR export and explicitly removed during account deletion.
- A user can submit only once per completed job. API rate limiting allows at most 10 feedback create/delete attempts per day per user.

## Verification boundary

The engineering system makes future feedback traceable to a completed conversion and records consent. It does not prove that a conversion was accurate, that a customer was satisfied, or that a testimonial is representative.

Local or synthetic submissions are suitable for form, API and database testing only. They must never be counted in the Phase 2 customer-feedback score, copied into marketing, or described as customer evidence.

The workstream remains **0/5** until five real customers:

1. sign in and complete an eligible conversion;
2. submit feedback through the linked job form;
3. provide the required product-research consent;
4. independently describe their actual result; and
5. retain the submission without withdrawing it.

Publication is an additional decision. Only a submission with `publish_consent = true` may be considered, and staff must review it before changing its moderation status or displaying it publicly.

## Security and privacy controls

- Server-side ownership and completed-status checks run before insert.
- Database row-level security repeats the ownership/completed-job condition.
- Browser roles cannot insert or update feedback directly, preventing moderation-state spoofing.
- Users can read and delete only their own records.
- Comments are length-bounded and output as React text, not raw HTML.
- Privacy policy copy discloses collection, purpose, retention, export and withdrawal.

## Deployment state

Migration `supabase/migrations/024_verified_customer_feedback.sql` was applied to the OnlyMyPDF production Supabase project on 24 September 2026. A live read-only verification returned `customer_feedback`, RLS enabled, three policies, and `false` for authenticated-role `INSERT` and `UPDATE` privileges. Other environments must apply the same migration before enabling the feature.

The remaining production gate is one real signed-in completed job through the dashboard. Its customer must submit their own feedback. Confirm that submission is private and `pending`, the GDPR export includes it, withdrawal removes it, and no marketing page renders it automatically.

## Automated evidence

- Payload validation covers job identifiers, all rating ranges, comment boundaries, required storage consent and independent publication consent.
- Route tests cover authenticated listing, creation, missing-consent rejection, mutation rate limiting and withdrawal.
- Migration tests assert RLS ownership, completed-job verification, pending status and direct-client write restrictions.
- GDPR export tests cover the new `customer_feedback` section and export format v4.
- Authenticated localhost smoke returned HTTP 200 for `/dashboard/feedback` and `/api/feedback`, with the page title rendered and empty eligible-job/feedback arrays handled correctly.
- Production Supabase schema verification confirmed the table, RLS, three ownership policies and removed direct browser insert/update privileges.
- TypeScript, ESLint, the focused unit suite, the full test suite and production build are required before the engineering checkpoint is committed.
