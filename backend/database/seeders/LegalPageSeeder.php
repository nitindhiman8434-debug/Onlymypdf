<?php

namespace Database\Seeders;

use App\Models\LegalPage;
use Illuminate\Database\Seeder;

class LegalPageSeeder extends Seeder
{
    public function run(): void
    {
        $pages = [
            ['privacy', 'Privacy Policy', 'गोपनीयता नीति', 'OnlyMyPDF is privacy-first. Client-side tools never upload your files; server-side files auto-delete after 1 hour. We store metadata only and never keep file contents or full extracted text. Raw IPs are hashed.'],
            ['terms', 'Terms of Use', 'उपयोग की शर्तें', 'Use the service lawfully and only process files you own or have permission to modify. Fair-usage limits apply. Provided as-is, with no guarantee of 100% conversion accuracy.'],
            ['refund', 'Refund Policy', 'रिफ़ंड नीति', '7-day refund for a first-time Pro purchase only, if usage is below 100 standard credits and below the heavy-usage threshold. No refunds for heavy usage, abuse, completed high-cost conversions, or trial misuse.'],
            ['fair-usage', 'Fair Usage Policy', 'उचित उपयोग नीति', 'Large file support with fair-use protection. Per-plan limits keep the service fast and affordable. Automated abuse may lead to suspension.'],
            ['cookie', 'Cookie Policy', 'कुकी नीति', 'We use essential cookies for sessions and security, plus privacy-preserving low-cost analytics.'],
            ['auto-delete', 'Auto-delete Policy', 'ऑटो-डिलीट नीति', 'Server-side input and output files auto-delete 1 hour after processing. Delete Now removes them instantly. Downloads are unavailable after deletion.'],
            ['abuse', 'Abuse / Malware Policy', 'दुरुपयोग / मैलवेयर नीति', 'Uploading malware, illegal content, or files you have no right to process is prohibited. Basic safety validation is performed.'],
            ['data-processing', 'Data Processing Policy', 'डेटा प्रोसेसिंग नीति', 'Files are processed in isolated temporary storage per job and deleted within 1 hour. AI/OCR intermediate text is deleted at cleanup. We act as a data processor.'],
        ];

        foreach ($pages as $p) {
            LegalPage::updateOrCreate(['slug' => $p[0]], [
                'title_en' => $p[1], 'title_hi' => $p[2],
                'body_en' => $p[3], 'body_hi' => $p[3],
                'published_at' => now(),
            ]);
        }
    }
}
