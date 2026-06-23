<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Benchmark Lab (Layer 5 of the conversion engine) — admin compares engines/providers.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('benchmark_files', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('category', [
                'resume', 'invoice', 'bank_statement', 'table_report', 'scanned',
                'certificate', 'form', 'multi_column', 'hindi', 'english', 'image_heavy',
            ]);
            $table->string('path');
            $table->unsignedInteger('pages')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('benchmark_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('benchmark_file_id')->constrained()->cascadeOnDelete();
            $table->string('tool_code');
            $table->string('engine_or_provider');
            $table->unsignedBigInteger('triggered_by')->nullable(); // admin_users.id
            $table->string('status')->default('queued');
            $table->timestamps();
        });

        Schema::create('benchmark_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('benchmark_run_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('processing_ms')->nullable();
            $table->unsignedBigInteger('output_size')->nullable();
            $table->float('ocr_confidence')->nullable();
            $table->unsignedInteger('tables_found')->nullable();
            $table->unsignedInteger('pages_converted')->nullable();
            $table->unsignedTinyInteger('user_rating')->nullable();
            $table->unsignedTinyInteger('admin_rating')->nullable();
            $table->string('engine_or_provider');
            $table->text('error_log')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('benchmark_results');
        Schema::dropIfExists('benchmark_runs');
        Schema::dropIfExists('benchmark_files');
    }
};
