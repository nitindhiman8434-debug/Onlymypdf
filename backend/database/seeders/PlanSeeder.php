<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'code' => 'guest_free', 'name' => 'Guest Free', 'region' => 'any', 'interval' => 'none',
                'price_minor' => 0, 'currency' => 'INR', 'monthly_credits' => 0,
                'daily_task_limit' => 5, 'daily_ai_limit' => 1, 'daily_high_accuracy_limit' => 5,
                'max_file_mb_normal' => 25, 'max_file_mb_heavy' => 25, 'sort' => 1,
            ],
            [
                'code' => 'free_trial', 'name' => 'Free Pro Trial', 'region' => 'any', 'interval' => 'trial',
                'price_minor' => 0, 'currency' => 'INR', 'monthly_credits' => 0,
                'daily_task_limit' => 20, 'daily_ai_limit' => 20, 'daily_high_accuracy_limit' => 5,
                'max_file_mb_normal' => 250, 'max_file_mb_heavy' => 100, 'sort' => 2,
            ],
            [
                'code' => 'pro_monthly_in', 'name' => 'Pro Monthly (India)', 'region' => 'in', 'interval' => 'monthly',
                'price_minor' => 29900, 'currency' => 'INR', 'monthly_credits' => 2100,
                'max_file_mb_normal' => 500, 'max_file_mb_heavy' => 200, 'sort' => 3,
            ],
            [
                'code' => 'pro_annual_in', 'name' => 'Pro Annual (India)', 'region' => 'in', 'interval' => 'annual',
                'price_minor' => 249900, 'currency' => 'INR', 'monthly_credits' => 2100,
                'max_file_mb_normal' => 500, 'max_file_mb_heavy' => 200, 'sort' => 4,
            ],
            [
                'code' => 'pro_monthly_global', 'name' => 'Pro Monthly (Global)', 'region' => 'global', 'interval' => 'monthly',
                'price_minor' => 900, 'currency' => 'USD', 'monthly_credits' => 2100,
                'max_file_mb_normal' => 500, 'max_file_mb_heavy' => 200, 'sort' => 5,
            ],
            [
                'code' => 'pro_annual_global', 'name' => 'Pro Annual (Global)', 'region' => 'global', 'interval' => 'annual',
                'price_minor' => 7900, 'currency' => 'USD', 'monthly_credits' => 2100,
                'max_file_mb_normal' => 500, 'max_file_mb_heavy' => 200, 'sort' => 6,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['code' => $plan['code']], $plan);
        }
    }
}
