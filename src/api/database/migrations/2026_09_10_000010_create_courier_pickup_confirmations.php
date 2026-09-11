<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('first_mile_tasks', function (Blueprint $table): void {
            $table->timestamp('picked_up_at')->nullable()->after('accepted_at');
        });

        Schema::create('courier_pickup_confirmations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('first_mile_task_id')->unique()->constrained('first_mile_tasks')->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('waybill_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->string('previous_status', 32);
            $table->string('new_status', 32);
            $table->unsignedInteger('schedule_revision');
            $table->uuid('correlation_id');
            $table->timestamp('picked_up_at');
            $table->timestamps();

            $table->unique(['courier_id', 'idempotency_key']);
            $table->index(['order_id', 'picked_up_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_pickup_confirmations');

        Schema::table('first_mile_tasks', function (Blueprint $table): void {
            $table->dropColumn('picked_up_at');
        });
    }
};
