<?php

use App\Http\Controllers\Api\FeatureFlagController;
use App\Http\Controllers\Api\JobController;
use App\Http\Controllers\Api\ToolController;
use Illuminate\Support\Facades\Route;

/*
| OnlyMyPDF API routes. See docs/API.md for the full surface. Endpoints marked
| (opt) accept guests with an X-Session-Token; (✓) require Sanctum auth.
*/

Route::get('/health', fn () => ['ok' => true, 'time' => now()->toIso8601String()]);

// ---- Public tool metadata ----
Route::get('/tools', [ToolController::class, 'index']);
Route::get('/tools/{code}', [ToolController::class, 'show']);
Route::get('/feature-flags', [FeatureFlagController::class, 'index']);

// ---- Jobs (guest-capable) ----
Route::prefix('jobs')->group(function () {
    Route::post('/initiate', [JobController::class, 'initiate']);
    Route::get('/{uuid}/status', [JobController::class, 'status']);
    Route::post('/{uuid}/delete-now', [JobController::class, 'deleteNow']);
    // TODO Phase 3: /{uuid}/upload, /{uuid}/download (signed), /{uuid}/rescue, /{uuid}/detection
});

// ---- Authenticated (Sanctum) ----
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', fn (\Illuminate\Http\Request $r) => $r->user()->load('plan'));
    // TODO Phase 2/7: credits, dashboard, invoices, checkout, subscription, support
});

/*
| TODO (phased): auth (register/login/google/verify), credits (balance/preview/ledger),
| dashboard, payments (razorpay/paypal + webhooks), invoices, support tickets,
| public contact, admin APIs, translations. Schemas are defined in docs/API.md.
*/
