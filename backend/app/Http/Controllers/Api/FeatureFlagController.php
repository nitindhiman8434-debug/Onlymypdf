<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeatureFlag;

class FeatureFlagController extends Controller
{
    /** GET /api/feature-flags — public flag map for the frontend. */
    public function index()
    {
        $keys = array_keys(config('onlymypdf.flags'));
        $flags = [];
        foreach ($keys as $key) {
            $flags[$key] = FeatureFlag::enabled($key);
        }
        return $flags;
    }
}
