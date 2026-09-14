<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_schedules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('created_by_logistics_id')->constrained('users')->restrictOnDelete();
            $table->string('reference', 32)->unique();
            $table->timestamp('scheduled_for');
            $table->string('status', 24)->default('scheduled');
            $table->unsignedSmallInteger('parcel_count');
            $table->unsignedInteger('revision')->default(1);
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->timestamps();
            $table->unique(['created_by_logistics_id', 'idempotency_key']);
            $table->index(['logistics_organization_id', 'logistics_hub_id', 'scheduled_for']);
            $table->index(['courier_id', 'scheduled_for']);
        });

        Schema::create('dispatch_schedule_shipments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('dispatch_schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('shipment_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('delivery_task_id')->unique()->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('sequence');
            $table->timestamps();
            $table->unique(['dispatch_schedule_id', 'sequence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_schedule_shipments');
        Schema::dropIfExists('dispatch_schedules');
    }
};
