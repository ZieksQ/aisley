<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sorting_lanes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('created_by_logistics_id')->constrained('users')->restrictOnDelete();
            $table->string('code', 24);
            $table->string('name', 80);
            $table->string('type', 16)->default('standard');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('position')->default(1);
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
            $table->unique(['logistics_organization_id', 'logistics_hub_id', 'code']);
            $table->index(['logistics_organization_id', 'logistics_hub_id', 'is_active', 'position']);
        });

        Schema::create('sorting_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('opened_by_logistics_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('closed_by_logistics_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference', 32)->unique();
            $table->string('status', 16)->default('open');
            $table->string('open_key', 80)->nullable()->unique();
            $table->unsignedSmallInteger('expected_count');
            $table->unsignedInteger('revision')->default(1);
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->unique(['opened_by_logistics_id', 'idempotency_key']);
            $table->index(['logistics_organization_id', 'logistics_hub_id', 'status', 'opened_at']);
        });

        Schema::create('sorting_session_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('sorting_session_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('shipment_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('sorting_lane_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('status', 16)->default('pending');
            $table->unsignedInteger('expected_shipment_revision');
            $table->string('exception_code', 32)->nullable();
            $table->text('exception_reason')->nullable();
            $table->timestamp('exception_recorded_at')->nullable();
            $table->timestamp('exception_resolved_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['sorting_session_id', 'shipment_id']);
            $table->index(['sorting_session_id', 'status', 'id']);
        });

        Schema::create('sorting_scans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('sorting_session_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('sorting_session_item_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('sorting_lane_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('shipment_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('recorded_by_logistics_id')->constrained('users')->restrictOnDelete();
            $table->uuid('client_id');
            $table->string('request_hash', 64);
            $table->string('reference', 128);
            $table->string('outcome', 16);
            $table->string('source', 16);
            $table->string('exception_code', 32)->nullable();
            $table->text('reason')->nullable();
            $table->timestamp('captured_at');
            $table->timestamp('processed_at');
            $table->timestamps();
            $table->unique(['logistics_organization_id', 'client_id']);
            $table->index(['sorting_session_id', 'outcome', 'processed_at']);
            $table->index(['shipment_id', 'processed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sorting_scans');
        Schema::dropIfExists('sorting_session_items');
        Schema::dropIfExists('sorting_sessions');
        Schema::dropIfExists('sorting_lanes');
    }
};
