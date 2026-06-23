<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// AI / OCR / conversion-provider usage accounting.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('ai_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('job_id')->constrained('tool_jobs')->cascadeOnDelete();
            $table->string('provider'); // gemini, openai, ...
            $table->enum('task', ['summary', 'translate', 'ask']);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->unsignedInteger('chunks')->default(0);
            $table->string('status')->default('success');
            $table->unsignedInteger('cost_estimate_minor')->default(0);
            $table->timestamps();
        });

        Schema::create('ocr_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('job_id')->constrained('tool_jobs')->cascadeOnDelete();
            $table->string('engine'); // tesseract, ocrmypdf, api:<name>
            $table->unsignedInteger('pages')->default(0);
            $table->float('confidence_avg')->nullable();
            $table->string('language')->nullable();
            $table->string('status')->default('success');
            $table->timestamps();
        });

        Schema::create('conversion_provider_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('job_id')->constrained('tool_jobs')->cascadeOnDelete();
            $table->string('provider');
            $table->string('tool_code');
            $table->unsignedInteger('pages')->default(0);
            $table->boolean('success')->default(true);
            $table->unsignedInteger('latency_ms')->nullable();
            $table->unsignedInteger('cost_estimate_minor')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversion_provider_usage');
        Schema::dropIfExists('ocr_usage');
        Schema::dropIfExists('ai_usage');
    }
};
