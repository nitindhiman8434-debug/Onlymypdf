<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Support tickets (public contact form + dashboard) and their messages.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('email');
            $table->string('subject');
            $table->string('tool_code')->nullable();
            $table->string('job_uuid')->nullable();
            $table->enum('status', ['open', 'pending', 'closed'])->default('open');
            $table->enum('source', ['public_contact', 'dashboard'])->default('public_contact');
            $table->enum('priority', ['low', 'normal', 'high'])->default('normal');
            $table->unsignedBigInteger('assigned_admin_id')->nullable();
            $table->timestamps();
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->enum('author_type', ['user', 'admin', 'system']);
            $table->text('body');
            $table->json('attachments')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
    }
};
