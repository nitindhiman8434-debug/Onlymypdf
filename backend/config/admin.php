<?php

return [
    /*
    | Admin panel path. Configurable from env so it can be hidden/rotated.
    | Default: only-admin-panel  →  https://onlymypdf.com/only-admin-panel
    */
    'path' => env('ADMIN_PATH', 'only-admin-panel'),

    // Admin panel is English only (the public site/dashboard is bilingual).
    'locale' => 'en',
];
