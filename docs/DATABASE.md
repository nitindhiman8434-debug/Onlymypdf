# OnlyMyPDF — Database Schema

MySQL / MariaDB. All tables `utf8mb4`. Timestamps on every table. Soft deletes where noted.
Migrations live in `backend/database/migrations/`. Seeds in `backend/database/seeders/`.

> Design principle: **store metadata, never files.** No table holds file contents or full
> extracted PDF text. Raw IPs are stored only as `ip_hash`.

## Core identity & billing

### `users`
| col | type | notes |
|-----|------|-------|
| id | bigint PK | |
| name | string | |
| email | string unique | |
| email_verified_at | timestamp null | email verification |
| password | string null | null for Google-only accounts |
| google_id | string null index | Google login |
| locale | enum('en','hi') | dashboard language, default en |
| plan_id | fk plans | current plan |
| trial_ends_at | timestamp null | Free Pro Trial expiry |
| current_credits | int default 0 | cached balance (source of truth = credits_ledger) |
| credits_reset_at | timestamp null | next monthly reset (billing-cycle based) |
| country / city | string null | coarse geo |
| ip_hash | string null | hashed, never raw |
| created_at / updated_at | | |

### `plans`
`id, code (guest_free|free_trial|pro_monthly_in|pro_annual_in|pro_monthly_global|pro_annual_global),
name, region (in|global|any), interval (none|monthly|annual|trial), price_minor (int),
currency (INR|USD), monthly_credits (int), daily_task_limit (int), daily_ai_limit (int),
daily_high_accuracy_limit (int), max_file_mb_normal (int), max_file_mb_heavy (int),
is_active (bool), sort`

### `subscriptions`
`id, user_id fk, plan_id fk, provider (razorpay|paypal|manual), provider_subscription_id,
status (active|trialing|past_due|canceled|expired), current_period_start, current_period_end,
cancel_at_period_end (bool), created_at, updated_at`

### `payments`
`id, user_id fk, subscription_id fk null, provider, provider_payment_id, amount_minor, currency,
status (created|captured|failed|refunded), method, coupon_id fk null, raw_payload json,
created_at, updated_at`

### `invoices`
`id, user_id fk, payment_id fk, number (unique, e.g. OMP-2026-000123), amount_minor, currency,
gst_amount_minor, gstin (string null), company_name, status (issued|paid|void),
issued_at, pdf_path (temp/regenerated), meta json`

## Credits & usage

### `credits_ledger` (append-only)
`id, user_id fk, delta (int, +grant/-spend), reason (monthly_grant|tool_spend|admin_adjust|refund),
tool_code (string null), job_id fk null, note (string null), balance_after (int),
expires_at (timestamp null, for monthly expiry), created_at`

### `usage_events`
`id, user_id fk null (null = guest), session_token (string null), tool_code, plan_code,
credits_used (int), high_accuracy (bool), status (success|failed), duration_ms (int null),
country, city, device, browser, ip_hash, created_at`

## Tools & jobs

### `tools`
`id, code (compress-pdf …), category (convert|compress|organize|edit|sign_security|ai|scan),
name_en, name_hi, slug, processing (client|server), credit_min (int), credit_max (int),
high_accuracy (bool), ai (bool), enabled (bool), beta (bool), sort, seo json`

### `tool_jobs`
`id, uuid (unique), user_id fk null, session_token null, tool_code, plan_code,
mode (fast|high_accuracy|null), status (queued|uploading|checking|reading|optimizing|
processing|quality|preparing|done|failed|deleted), priority (int),
input_meta json {filename,size,mime,pages}, options json, detection json (from smart detection),
quality_score (int null 0-100), credits_estimated (int), credits_charged (int null),
queue (standard|conversion|high_accuracy|ocr|ai|cleanup), provider_used (string null),
error_code (string null), error_message (string null),
output_format (string null), download_token (string null), expires_at (timestamp),
started_at, finished_at, created_at, updated_at`

### `file_metadata` (logged-in history; **no file content**)
`id, user_id fk, job_id fk, filename, tool_code, size_bytes, status, credits_used,
duration_ms, output_format, created_at` — download is unavailable after the 1h deletion.

### `temp_files` (tracked for guaranteed cleanup)
`id, job_id fk, path, kind (input|output|intermediate), size_bytes, expires_at, deleted_at null`

## AI / OCR / providers

### `ai_usage`
`id, user_id fk null, job_id fk, provider (gemini|openai|...), task (summary|translate|ask),
input_tokens, output_tokens, chunks, status, cost_estimate_minor, created_at`

### `ocr_usage`
`id, user_id fk null, job_id fk, engine (tesseract|ocrmypdf|api:<name>), pages, confidence_avg,
language, status, created_at`

### `conversion_provider_usage`
`id, user_id fk null, job_id fk, provider, tool_code, pages, success (bool), latency_ms,
cost_estimate_minor, created_at`

## Benchmark lab

### `benchmark_files`
`id, name, category (resume|invoice|bank_statement|table_report|scanned|certificate|form|
multi_column|hindi|english|image_heavy), path, pages, notes, created_at`

### `benchmark_runs`
`id, benchmark_file_id fk, tool_code, engine_or_provider, triggered_by (admin_id),
status, created_at`

### `benchmark_results`
`id, benchmark_run_id fk, processing_ms, output_size, ocr_confidence (null), tables_found (null),
pages_converted, user_rating (null), admin_rating (null), engine_or_provider, error_log (text null),
created_at`

## Support

### `support_tickets`
`id, user_id fk null, name, email, subject, tool_code (null), job_uuid (null),
status (open|pending|closed), source (public_contact|dashboard), priority, assigned_admin_id null,
created_at, updated_at`

### `support_messages`
`id, ticket_id fk, author_type (user|admin|system), body, attachments json null, created_at`

## Admin & governance

### `admin_users` (Filament guard)
`id, name, email unique, password, role (super_admin|admin|support), is_active, last_login_at`

### `admin_audit_logs`
`id, admin_id fk, action, target_type, target_id, changes json, ip_hash, created_at`

### `rate_limit_events`
`id, key (ip_hash|session|user), tool_code, bucket (date), count, plan_code, created_at`

### `feature_flags`
`id, key (unique), enabled (bool), value json null, description, updated_by null, updated_at`

### `coupons`
`id, code unique, type (percent|fixed|trial_extension), amount (int), currency null,
duration (once|recurring|lifetime), trial_extra_days (int null), plan_code (null = any),
expires_at null, usage_limit null, used_count, is_active, created_at`

## CMS-lite

### `translations`
`id, locale (en|hi), group, key, value, updated_at` — overrides for editable strings.

### `legal_pages`
`id, slug (privacy|terms|refund|fair-usage|cookie|auto-delete|abuse|data-processing),
title_en, title_hi, body_en (longtext), body_hi (longtext), version, published_at, updated_at`

## Relationships (summary)
- `users` 1—* `subscriptions`, `payments`, `invoices`, `credits_ledger`, `usage_events`,
  `file_metadata`, `support_tickets`.
- `plans` 1—* `users`, `subscriptions`.
- `tool_jobs` 1—1 `file_metadata` (when logged in), 1—* `temp_files`, `ai_usage`, `ocr_usage`.
- `benchmark_files` 1—* `benchmark_runs` 1—* `benchmark_results`.
- `support_tickets` 1—* `support_messages`.
