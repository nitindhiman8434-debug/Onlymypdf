<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tool extends Model
{
    protected $guarded = [];

    protected $casts = [
        'high_accuracy' => 'boolean',
        'ai' => 'boolean',
        'enabled' => 'boolean',
        'beta' => 'boolean',
        'seo' => 'array',
    ];

    public function scopeEnabled($query)
    {
        return $query->where('enabled', true);
    }
}
