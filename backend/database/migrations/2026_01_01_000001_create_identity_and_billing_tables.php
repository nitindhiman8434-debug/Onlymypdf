<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Core identity & billing: plans, users, subscriptions, payments, invoices.
// (Replaces Laravel's default users migration — delete that one.)
return new class extends Migration {
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // guest_free, free_trial, pro_monthly_in, ...
            $table->string('name');
            $table->enum('region', ['in', 'global', 'any'])->default('any');
            $table->enum('interval', ['none', 'monthly', 'annual', 'trial'])->default('none');
            $table->unsignedInteger('price_minor')->default(0); // paise / cents
            $table->string('currency', 3)->default('INR');
            $table->unsignedInteger('monthly_credits')->default(0);
            $table->unsignedInteger('daily_task_limit')->default(0);
            $table->unsignedInteger('daily_ai_limit')->default(0);
            $table->unsignedInteger('daily_high_accuracy_limit')->default(0);
            $table->unsignedInteger('max_file_mb_normal')->default(25);
            $table->unsignedInteger('max_file_mb_heavy')->default(25);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable(); // null for Google-only accounts
            $table->string('google_id')->nullable()->index();
            $table->enum('locale', ['en', 'hi'])->default('en');
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->timestamp('trial_ends_at')->nullable();
            $table->integer('current_credits')->default(0); // cached; source of truth = ledger
            $table->timestamp('credits_reset_at')->nullable();
            $table->string('country')->nullable();
            $table->string('city')->nullable();
            $table->string('ip_hash')->nullable(); // hashed, never raw
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained();
            $table->enum('provider', ['razorpay', 'paypal', 'manual'])->default('manual');
            $table->string('provider_subscription_id')->nullable();
            $table->enum('status', ['active', 'trialing', 'past_due', 'canceled', 'expired'])->default('active');
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('provider', ['razorpay', 'paypal']);
            $table->string('provider_payment_id')->nullable();
            $table->unsignedInteger('amount_minor');
            $table->string('currency', 3)->default('INR');
            $table->enum('status', ['created', 'captured', 'failed', 'refunded'])->default('created');
            $table->string('method')->nullable();
            $table->foreignId('coupon_id')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->constrained();
            $table->string('number')->unique(); // OMP-2026-000123
            $table->unsignedInteger('amount_minor');
            $table->string('currency', 3)->default('INR');
            $table->unsignedInteger('gst_amount_minor')->default(0);
            $table->string('gstin')->nullable();
            $table->string('company_name')->default('Only My PDF Limited');
            $table->enum('status', ['issued', 'paid', 'void'])->default('issued');
            $table->timestamp('issued_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('plans');
    }
};
