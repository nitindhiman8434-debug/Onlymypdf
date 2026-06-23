<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class FeatureFlag extends Model
{
    protected $guarded = [];

    protected $casts = [
        'enabled' => 'boolean',
        'value' => 'array',
    ];

    /** Runtime check with a short cache; DB overrides config defaults. */
    public static function enabled(string $key): bool
    {
        return Cache::remember("flag:$key", 60, function () use ($key) {
            $flag = static::where('key', $key)->first();
            if ($flag) {
                return $flag->enabled;
            }
            return (bool) config("onlymypdf.flags.$key", false);
        });
    }
}
