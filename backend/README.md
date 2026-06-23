# OnlyMyPDF — Backend (Laravel 11)

API + Filament admin + Redis/Horizon queues + scheduler. This folder contains the
**application code** (migrations, models, services, controllers, seeders, config, routes).
The Laravel framework itself is pulled in by Composer.

## Setup
```bash
# If starting from a bare checkout, install the framework skeleton + deps:
composer install                       # pulls laravel/framework, filament, horizon, sanctum…

cp .env.example .env
php artisan key:generate
php artisan migrate --seed              # creates schema + seeds plans/tools/admin/flags/legal
php artisan storage:link

php artisan serve                       # API at http://localhost:8000
php artisan horizon                     # queue workers (separate terminal)
php artisan schedule:work               # scheduler — runs temp:cleanup every minute
```

> Greenfield note: this schema defines its own `users` table, so delete Laravel's
> default `0001_01_01_000000_create_users_table.php` if present (ours lives in
> `2026_01_01_000001_create_identity_and_billing_tables.php`).

## What's implemented (Phase 2 foundation)
- **Migrations** for every entity in [`../docs/DATABASE.md`](../docs/DATABASE.md).
- **Seeders**: plans (Guest/Trial/Pro ×4), tools + credit costs, admin user, feature flags, legal drafts.
- **Models**: User, Plan, Tool, ToolJob, TempFile, CreditLedger, FeatureFlag, AdminUser, LegalPage.
- **Services**: `CreditService` (2100-credit wallet, grant/spend/adjust, monthly expiry),
  `LimitService` (daily task limits + per-plan file size).
- **API**: tools, feature flags, job initiate/status/delete-now, health, `auth/me` (Sanctum).
- **Cleanup**: `temp:cleanup` command + scheduler — enforces the 1-hour auto-delete.
- **Tests**: `CreditServiceTest`, `LimitServiceTest`.

## Admin panel (Filament)
- Lives at `config('admin.path')` → `ADMIN_PATH` env (default `/only-admin-panel`), English only.
- Guard: `admin_users` table (`AdminUser` implements `FilamentUser::canAccessPanel`).
- Resources to add (Phase 2 continued): Users, Plans, Subscriptions, Payments, Invoices, Credits,
  Tool usage, Jobs, Failed jobs, Errors, AI/OCR usage, Provider usage, Benchmark Lab, Coupons,
  Ads, Support, Analytics, Rate limits, Guest usage, Trial abuse, Feature flags, Tool toggles,
  File-size limits, Credit costs, Content, SEO, Legal. (See admin module list in the spec.)

## Run tests
```bash
php artisan test
php artisan test --filter=CreditServiceTest
```

## Next phases (see ../docs/ROADMAP.md)
Auth (Google + email verification), payments (Razorpay/PayPal + GST invoices), the Filament
resources above, and wiring the worker (Redis job dispatch + signed downloads).
