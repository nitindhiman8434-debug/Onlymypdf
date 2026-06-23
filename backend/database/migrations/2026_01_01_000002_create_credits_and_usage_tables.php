<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Credits wallet (append-only ledger) + usage analytics events.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('credits_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->integer('delta'); // +grant / -spend
            $table->enum('reason', ['monthly_grant', 'tool_spend', 'admin_adjust', 'refund']);
            $table->string('tool_code')->nullable();
            $table->unsignedBigInteger('job_id')->nullable();
            $table->string('note')->nullable();
            $table->integer('balance_after');
            $table->timestamp('expires_at')->nullable(); // monthly expiry of unused credits
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('usage_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // null = guest
            $table->string('session_token')->nullable();
            $table->string('tool_code');
            $table->string('plan_code');
            $table->unsignedInteger('credits_used')->default(0);
            $table->boolean('high_accuracy')->default(false);
            $table->enum('status', ['success', 'failed'])->default('success');
            $table->unsignedInteger('duration_ms')->nullable();
            $table->string('country')->nullable();
            $table->string('city')->nullable();
            $table->string('device')->nullable();
            $table->string('browser')->nullable();
            $table->string('ip_hash')->nullable();
            $table->timestamps();
            $table->index(['tool_code', 'created_at']);
            $table->index('country');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_events');
        Schema::dropIfExists('credits_ledger');
    }
};
