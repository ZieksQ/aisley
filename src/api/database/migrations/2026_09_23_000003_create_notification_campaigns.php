<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_campaigns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title', 120);
            $table->text('body');
            $table->string('audience_key', 64);
            $table->string('destination_type', 32)->nullable();
            $table->uuid('destination_id')->nullable();
            $table->string('destination_slug')->nullable();
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('created_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('previewed_at')->nullable();
            $table->unsignedInteger('preview_revision')->nullable();
            $table->unsignedInteger('preview_eligible_count')->nullable();
            $table->string('send_idempotency_hash', 64)->nullable();
            $table->unsignedInteger('send_revision')->nullable();
            $table->timestamp('audience_cutoff_at')->nullable();
            $table->unsignedInteger('snapshot_count')->default(0);
            $table->unsignedInteger('delivered_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
            $table->index(['completed_at', 'status']);
        });

        Schema::create('notification_campaign_recipients', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('notification_campaigns')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
            $table->uuid('notification_id')->unique();
            $table->string('status', 32)->default('pending');
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->string('last_error_category', 80)->nullable();
            $table->timestamps();
            $table->unique(['campaign_id', 'user_id']);
            $table->index(['campaign_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_campaign_recipients');
        Schema::dropIfExists('notification_campaigns');
    }
};
