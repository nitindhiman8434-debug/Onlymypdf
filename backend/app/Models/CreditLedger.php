<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditLedger extends Model
{
    protected $table = 'credits_ledger';

    protected $guarded = [];

    protected $casts = [
        'expires_at' => 'datetime',
    ];
}
