<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_lifecycle_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->restrictOnDelete();
            $table->string('action');
            $table->string('previous_status');
            $table->string('new_status');
            $table->text('reason')->nullable();
            $table->foreignUuid('acted_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->string('source_feature')->default('user_account_management');
            $table->string('source_reference_type')->nullable();
            $table->uuid('source_reference_id')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['user_id', 'occurred_at']);
            $table->index(['acted_by_admin_id', 'occurred_at']);
            $table->index(['source_reference_type', 'source_reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_lifecycle_events');
    }
};
