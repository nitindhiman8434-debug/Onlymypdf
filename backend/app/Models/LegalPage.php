<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LegalPage extends Model
{
    protected $guarded = [];

    protected $casts = [
        'published_at' => 'datetime',
    ];
}
