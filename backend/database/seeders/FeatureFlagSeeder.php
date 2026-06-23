<?php

namespace Database\Seeders;

use App\Models\FeatureFlag;
use Illuminate\Database\Seeder;

class FeatureFlagSeeder extends Seeder
{
    public function run(): void
    {
        $flags = [
            'ask_pdf_enabled' => false,
            'ads_enabled' => false,
            'secure_share_links_enabled' => false,
            'apple_login_enabled' => false,
            'high_accuracy_enabled' => true,
            'translate_pdf_enabled' => true,
            'ocr_enabled' => true,
            'scanner_enabled' => true,
        ];

        foreach ($flags as $key => $enabled) {
            FeatureFlag::updateOrCreate(['key' => $key], [
                'enabled' => $enabled,
                'description' => ucfirst(str_replace('_', ' ', $key)),
            ]);
        }
    }
}
