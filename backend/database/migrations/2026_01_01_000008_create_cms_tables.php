<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// CMS-lite: editable translations and legal pages (bilingual).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('translations', function (Blueprint $table) {
            $table->id();
            $table->enum('locale', ['en', 'hi']);
            $table->string('group');
            $table->string('key');
            $table->text('value');
            $table->timestamps();
            $table->unique(['locale', 'group', 'key']);
        });

        Schema::create('legal_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique(); // privacy, terms, refund, ...
            $table->string('title_en');
            $table->string('title_hi');
            $table->longText('body_en');
            $table->longText('body_hi');
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_pages');
        Schema::dropIfExists('translations');
    }
};
