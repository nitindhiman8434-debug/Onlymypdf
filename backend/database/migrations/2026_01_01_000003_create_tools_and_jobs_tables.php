<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tools catalog, processing jobs, logged-in metadata history, tracked temp files.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('tools', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->enum('category', ['convert', 'compress', 'organize', 'edit', 'sign_security', 'ai', 'scan']);
            $table->string('name_en');
            $table->string('name_hi');
            $table->string('slug')->unique();
            $table->enum('processing', ['client', 'server'])->default('server');
            $table->unsignedInteger('credit_min')->default(0);
            $table->unsignedInteger('credit_max')->default(0);
            $table->boolean('high_accuracy')->default(false);
            $table->boolean('ai')->default(false);
            $table->boolean('enabled')->default(true);
            $table->boolean('beta')->default(false);
            $table->unsignedInteger('sort')->default(0);
            $table->json('seo')->nullable();
            $table->timestamps();
        });

        Schema::create('tool_jobs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('session_token')->nullable();
            $table->string('tool_code');
            $table->string('plan_code');
            $table->enum('mode', ['fast', 'high_accuracy'])->nullable();
            $table->enum('status', [
                'queued', 'uploading', 'checking', 'reading', 'optimizing',
                'processing', 'quality', 'preparing', 'done', 'failed', 'deleted',
            ])->default('queued');
            $table->unsignedInteger('priority')->default(5);
            $table->json('input_meta')->nullable();   // filename, size, mime, pages
            $table->json('options')->nullable();
            $table->json('detection')->nullable();     // smart-detection result
            $table->unsignedTinyInteger('quality_score')->nullable(); // 0-100 estimate
            $table->unsignedInteger('credits_estimated')->default(0);
            $table->unsignedInteger('credits_charged')->nullable();
            $table->string('queue')->default('standard');
            $table->string('provider_used')->nullable();
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->string('output_format')->nullable();
            $table->string('download_token')->nullable();
            $table->timestamp('expires_at')->nullable(); // 1-hour TTL
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'queue']);
            $table->index('expires_at');
        });

        // Logged-in users' history — METADATA ONLY, never file contents.
        Schema::create('file_metadata', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('job_id')->constrained('tool_jobs')->cascadeOnDelete();
            $table->string('filename');
            $table->string('tool_code');
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('status');
            $table->unsignedInteger('credits_used')->default(0);
            $table->unsignedInteger('duration_ms')->nullable();
            $table->string('output_format')->nullable();
            $table->timestamps();
        });

        // Tracked temp files to guarantee cleanup (defence in depth alongside TTL sweep).
        Schema::create('temp_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained('tool_jobs')->cascadeOnDelete();
            $table->string('path');
            $table->enum('kind', ['input', 'output', 'intermediate']);
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temp_files');
        Schema::dropIfExists('file_metadata');
        Schema::dropIfExists('tool_jobs');
        Schema::dropIfExists('tools');
    }
};
