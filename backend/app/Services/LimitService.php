<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Daily task limits for guest/trial tiers (Pro uses credits instead).
 * Counters live in Redis keyed by ip_hash/session/user + date. All limits are
 * admin-configurable via config('onlymypdf.daily_limits').
 */
class LimitService
{
    /** Returns true if the action is allowed, and increments the counter. */
    public function consume(string $key, string $tier, string $bucket = 'tasks'): bool
    {
        $limit = (int) config("onlymypdf.daily_limits.$tier.$bucket", 0);
        if ($limit === 0 && $tier === 'pro') {
            return true; // Pro is credit-based, not task-limited
        }

        $cacheKey = "limit:$tier:$bucket:$key:" . now()->toDateString();
        $count = (int) Cache::get($cacheKey, 0);
        if ($count >= $limit) {
            return false;
        }
        Cache::put($cacheKey, $count + 1, now()->endOfDay());
        return true;
    }

    public function remaining(string $key, string $tier, string $bucket = 'tasks'): int
    {
        $limit = (int) config("onlymypdf.daily_limits.$tier.$bucket", 0);
        $cacheKey = "limit:$tier:$bucket:$key:" . now()->toDateString();
        return max(0, $limit - (int) Cache::get($cacheKey, 0));
    }

    /** Max file size (bytes) for a tier + tool weight. */
    public function maxFileBytes(string $tier, bool $heavy = false): int
    {
        $mb = (int) config("onlymypdf.limits.$tier." . ($heavy ? 'heavy' : 'normal'), 25);
        return $mb * 1024 * 1024;
    }
}
