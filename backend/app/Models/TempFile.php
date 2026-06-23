<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TempFile extends Model
{
    protected $guarded = [];

    protected $casts = [
        'expires_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
