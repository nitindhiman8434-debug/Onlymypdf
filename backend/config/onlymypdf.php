<?php

/*
| OnlyMyPDF product configuration. Most of these are also editable at runtime
| via the admin panel (feature_flags + plan/tool settings); env provides the
| safe defaults / launch values.
*/
return [
    // Temp file lifetime (server-side files auto-delete after this).
    'temp_ttl_minutes' => env('TEMP_TTL_MINUTES', 60),

    // Unified monthly credit wallet for Pro.
    'monthly_credits' => env('MONTHLY_CREDITS', 2100),

    // File size limits (MB) — configurable per plan in admin; these are launch defaults.
    'limits' => [
        'guest'  => ['normal' => 25,  'heavy' => 25],
        'trial'  => ['normal' => 250, 'heavy' => 100],
        'pro'    => ['normal' => 500, 'heavy' => 200],
    ],

    // Daily task limits (rate-limited) for non-credit tiers.
    'daily_limits' => [
        'guest' => ['tasks' => 5,  'ai' => 1, 'high_accuracy' => 5],
        'trial' => ['tasks' => 20, 'ai' => 20, 'high_accuracy' => 5],
    ],

    // Queues by priority tier.
    'queues' => ['standard', 'conversion', 'high_accuracy', 'ocr', 'ai', 'cleanup'],

    // Feature flags (DB overrides these at runtime).
    'flags' => [
        'ask_pdf_enabled' => env('ASK_PDF_ENABLED', false),
        'ads_enabled' => env('ADS_ENABLED', false),
        'secure_share_links_enabled' => env('SECURE_SHARE_LINKS_ENABLED', false),
        'apple_login_enabled' => env('APPLE_LOGIN_ENABLED', false),
        'high_accuracy_enabled' => env('HIGH_ACCURACY_ENABLED', true),
        'translate_pdf_enabled' => env('TRANSLATE_PDF_ENABLED', true),
        'ocr_enabled' => env('OCR_ENABLED', true),
        'scanner_enabled' => env('SCANNER_ENABLED', true),
    ],

    // Download link signing TTL (seconds).
    'download_url_ttl' => env('DOWNLOAD_URL_TTL', 600),

    // Pluggable provider selection (worker reads these too).
    'ai_provider' => env('AI_PROVIDER', 'gemini'),
    'conversion_fallback_provider' => env('CONVERSION_FALLBACK_PROVIDER', null),
];
