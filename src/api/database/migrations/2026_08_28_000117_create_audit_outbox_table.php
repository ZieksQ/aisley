<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_outbox', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name')->nullable();
            $table->string('action', 128);
            $table->string('source_feature', 64);
            $table->string('auditable_type');
            $table->uuid('auditable_id');
            $table->json('target_snapshot')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->json('changed_fields')->nullable();
            $table->json('metadata')->nullable();
            $table->string('request_id', 64)->nullable();
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('occurred_at');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('available_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['processed_at', 'available_at'], 'audit_outbox_pending_idx');
            $table->index(['auditable_type', 'auditable_id'], 'audit_outbox_target_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_outbox');
    }
};
