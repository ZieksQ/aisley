<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('reference', 48)->unique();
            $table->foreignUuid('requester_user_id')->constrained('users')->restrictOnDelete();
            $table->string('requester_role', 20);
            $table->foreignUuid('assignee_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('subject', 150);
            $table->string('category', 20);
            $table->string('status', 32)->default('open');
            $table->unsignedInteger('revision')->default(1);
            $table->unsignedInteger('last_sequence')->default(0);
            $table->timestamp('last_activity_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['requester_user_id', 'last_activity_at', 'id']);
            $table->index(['status', 'last_activity_at', 'id']);
            $table->index(['assignee_user_id', 'status', 'last_activity_at']);
        });

        Schema::create('support_ticket_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('ticket_id')->constrained('support_tickets')->restrictOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('type', 20);
            $table->foreignUuid('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('actor_role', 20);
            $table->text('body')->nullable();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32)->nullable();
            $table->foreignUuid('from_assignee_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignUuid('to_assignee_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at');
            $table->unique(['ticket_id', 'sequence']);
        });

        Schema::create('support_ticket_read_markers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('ticket_id')->constrained('support_tickets')->restrictOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('last_read_sequence')->default(0);
            $table->timestamps();
            $table->unique(['ticket_id', 'user_id']);
        });

        Schema::create('support_ticket_idempotency_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 80);
            $table->uuid('idempotency_key');
            $table->string('payload_hash', 64);
            $table->json('response_payload');
            $table->unsignedSmallInteger('response_status');
            $table->timestamps();
            $table->unique(['actor_user_id', 'action', 'idempotency_key'], 'support_ticket_receipts_actor_action_key_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_idempotency_receipts');
        Schema::dropIfExists('support_ticket_read_markers');
        Schema::dropIfExists('support_ticket_events');
        Schema::dropIfExists('support_tickets');
    }
};
