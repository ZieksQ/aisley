<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactional_emails', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role');
            $table->string('kind');
            $table->string('deduplication_key')->unique();
            $table->text('payload')->nullable();
            $table->string('status')->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestampTz('available_at');
            $table->uuid('claim_token')->nullable();
            $table->timestampTz('claim_expires_at')->nullable();
            $table->timestampTz('accepted_at')->nullable();
            $table->string('last_error_code')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'available_at']);
            $table->index(['status', 'claim_expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactional_emails');
    }
};
