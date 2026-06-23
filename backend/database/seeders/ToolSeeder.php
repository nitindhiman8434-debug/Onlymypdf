<?php

namespace Database\Seeders;

use App\Models\Tool;
use Illuminate\Database\Seeder;

/**
 * Seeds the tool catalog + default credit costs. Mirrors the frontend
 * registry (frontend/lib/tools.ts). Keep the two in sync.
 */
class ToolSeeder extends Seeder
{
    public function run(): void
    {
        // [code, slug, category, processing, min, max, name_en, name_hi, ha, ai, enabled]
        $tools = [
            ['compress-pdf', 'compress-pdf', 'compress', 'server', 1, 3, 'Compress PDF', 'PDF कंप्रेस करें', false, false, true],
            ['merge-pdf', 'merge-pdf', 'organize', 'client', 1, 1, 'Merge PDF', 'PDF मर्ज करें', false, false, true],
            ['split-pdf', 'split-pdf', 'organize', 'client', 1, 1, 'Split PDF', 'PDF विभाजित करें', false, false, true],
            ['rotate-pdf', 'rotate-pdf', 'organize', 'client', 1, 1, 'Rotate PDF', 'PDF घुमाएँ', false, false, true],
            ['delete-pdf-pages', 'delete-pdf-pages', 'organize', 'client', 1, 1, 'Delete PDF Pages', 'PDF पेज हटाएँ', false, false, true],
            ['extract-pdf-pages', 'extract-pdf-pages', 'organize', 'client', 1, 1, 'Extract PDF Pages', 'PDF पेज निकालें', false, false, true],
            ['organize-pdf', 'organize-pdf', 'organize', 'client', 1, 1, 'Organize PDF', 'PDF व्यवस्थित करें', false, false, true],
            ['pdf-reader', 'pdf-reader', 'organize', 'client', 0, 0, 'PDF Reader', 'PDF रीडर', false, false, true],
            ['number-pages', 'number-pages', 'edit', 'client', 1, 2, 'Number Pages', 'पेज नंबर लगाएँ', false, false, true],
            ['crop-pdf', 'crop-pdf', 'edit', 'client', 1, 2, 'Crop PDF', 'PDF क्रॉप करें', false, false, true],
            ['watermark-pdf', 'watermark-pdf', 'edit', 'client', 1, 2, 'Watermark PDF', 'PDF वॉटरमार्क', false, false, true],
            ['pdf-form-filler', 'pdf-form-filler', 'edit', 'client', 1, 2, 'PDF Form Filler', 'PDF फॉर्म फिलर', false, false, true],
            ['flatten-pdf', 'flatten-pdf', 'edit', 'server', 2, 2, 'Flatten PDF', 'PDF फ्लैटन करें', false, false, true],
            ['pdf-to-word', 'pdf-to-word', 'convert', 'server', 5, 30, 'PDF to Word', 'PDF से Word', true, false, true],
            ['pdf-to-excel', 'pdf-to-excel', 'convert', 'server', 8, 40, 'PDF to Excel', 'PDF से Excel', true, false, true],
            ['pdf-to-ppt', 'pdf-to-ppt', 'convert', 'server', 5, 20, 'PDF to PPT', 'PDF से PPT', false, false, true],
            ['pdf-to-jpg', 'pdf-to-jpg', 'convert', 'server', 1, 3, 'PDF to JPG', 'PDF से JPG', false, false, true],
            ['word-to-pdf', 'word-to-pdf', 'convert', 'server', 1, 3, 'Word to PDF', 'Word से PDF', false, false, true],
            ['excel-to-pdf', 'excel-to-pdf', 'convert', 'server', 1, 3, 'Excel to PDF', 'Excel से PDF', false, false, true],
            ['ppt-to-pdf', 'ppt-to-pdf', 'convert', 'server', 1, 3, 'PPT to PDF', 'PPT से PDF', false, false, true],
            ['jpg-to-pdf', 'jpg-to-pdf', 'convert', 'client', 1, 3, 'JPG to PDF', 'JPG से PDF', false, false, true],
            ['html-to-pdf', 'html-to-pdf', 'convert', 'server', 1, 3, 'HTML to PDF', 'HTML से PDF', false, false, true],
            ['txt-to-pdf', 'txt-to-pdf', 'convert', 'server', 1, 2, 'TXT to PDF', 'TXT से PDF', false, false, true],
            ['rtf-to-pdf', 'rtf-to-pdf', 'convert', 'server', 1, 2, 'RTF to PDF', 'RTF से PDF', false, false, true],
            ['odt-to-pdf', 'odt-to-pdf', 'convert', 'server', 1, 2, 'ODT to PDF', 'ODT से PDF', false, false, true],
            ['sign-pdf', 'sign-pdf', 'sign_security', 'client', 1, 2, 'Sign PDF', 'PDF साइन करें', false, false, true],
            ['unlock-pdf', 'unlock-pdf', 'sign_security', 'client', 1, 2, 'Unlock PDF', 'PDF अनलॉक करें', false, false, true],
            ['protect-pdf', 'protect-pdf', 'sign_security', 'client', 1, 2, 'Protect PDF', 'PDF सुरक्षित करें', false, false, true],
            ['pdf-scanner', 'pdf-scanner', 'scan', 'client', 1, 2, 'PDF Scanner', 'PDF स्कैनर', false, false, true],
            ['pdf-ocr', 'pdf-ocr', 'scan', 'server', 10, 30, 'PDF OCR', 'PDF OCR', true, false, true],
            ['extract-tables', 'extract-tables-from-pdf', 'scan', 'server', 8, 40, 'Extract Tables from PDF', 'PDF से टेबल निकालें', true, false, true],
            ['ai-summary', 'ai-pdf-summarizer', 'ai', 'server', 5, 15, 'AI PDF Summarizer', 'AI PDF सारांश', false, true, true],
            ['translate-pdf', 'translate-pdf', 'ai', 'server', 10, 60, 'Translate PDF', 'PDF अनुवाद करें', true, true, true],
            // Phase 2 — disabled by feature flag at launch.
            ['ask-pdf', 'ask-pdf', 'ai', 'server', 1, 5, 'Ask PDF', 'PDF से पूछें', false, true, false],
        ];

        foreach ($tools as $i => $t) {
            Tool::updateOrCreate(['code' => $t[0]], [
                'slug' => $t[1], 'category' => $t[2], 'processing' => $t[3],
                'credit_min' => $t[4], 'credit_max' => $t[5],
                'name_en' => $t[6], 'name_hi' => $t[7],
                'high_accuracy' => $t[8], 'ai' => $t[9], 'enabled' => $t[10],
                'sort' => $i,
            ]);
        }
    }
}
