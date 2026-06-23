<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Admin users + audit logs, rate-limit events, feature flags, coupons.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('admin_users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('role', ['super_admin', 'admin', 'support'])->default('admin');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('admin_users')->cascadeOnDelete();
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->json('changes')->nullable();
            $table->string('ip_hash')->nullable();
            $table->timestamps();
        });

        Schema::create('rate_limit_events', function (Blueprint $table) {
            $table->id();
            $table->string('key'); // ip_hash | session | user
            $table->string('tool_code')->nullable();
            $table->date('bucket');
            $table->unsignedInteger('count')->default(0);
            $table->string('plan_code')->nullable();
            $table->timestamps();
            $table->index(['key', 'bucket']);
        });

        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->boolean('enabled')->default(false);
            $table->json('value')->nullable();
            $table->string('description')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->enum('type', ['percent', 'fixed', 'trial_extension']);
            $table->unsignedInteger('amount')->default(0);
            $table->string('currency', 3)->nullable();
            $table->enum('duration', ['once', 'recurring', 'lifetime'])->default('once');
            $table->unsignedInteger('trial_extra_days')->nullable();
            $table->string('plan_code')->nullable(); // null = any plan
            $table->timestamp('expires_at')->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('feature_flags');
        Schema::dropIfExists('rate_limit_events');
        Schema::dropIfExists('admin_audit_logs');
        Schema::dropIfExists('admin_users');
    }
};
