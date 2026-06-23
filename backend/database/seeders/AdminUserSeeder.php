<?php

namespace Database\Seeders;

use App\Models\AdminUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // CHANGE THIS PASSWORD IMMEDIATELY after first login.
        AdminUser::updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@onlymypdf.com')],
            [
                'name' => 'OnlyMyPDF Admin',
                'password' => Hash::make(env('ADMIN_PASSWORD', 'ChangeMe!2026')),
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );
    }
}
