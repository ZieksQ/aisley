<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('first_mile_tasks', function (Blueprint $table) {
            $table->unsignedSmallInteger('failed_pickup_count')->default(0);
            $table->timestamp('released_at')->nullable();
            $table->string('release_reason', 32)->nullable();
        });
        Schema::create('pickup_decisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pickup_schedule_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('first_mile_task_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('action', 32);
            $table->string('request_hash', 64);
            $table->text('reason');
            $table->json('result');
            $table->timestamp('occurred_at');
            $table->unique(['courier_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pickup_decisions');
        Schema::table('first_mile_tasks', function (Blueprint $table) {
            $table->dropColumn(['failed_pickup_count', 'released_at', 'release_reason']);
        });
    }
};
