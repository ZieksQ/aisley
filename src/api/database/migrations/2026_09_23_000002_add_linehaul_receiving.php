<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('linehaul_trips', function (Blueprint $table): void {
            $table->timestampTz('arrived_at')->nullable();
            $table->foreignUuid('arrived_by')->nullable()->constrained('users');
            $table->timestampTz('unloading_closed_at')->nullable();
            $table->foreignUuid('unloading_closed_by')->nullable()->constrained('users');
            $table->string('unloading_outcome')->nullable();
        });
        Schema::table('shipments', fn (Blueprint $table) => $table->boolean('condition_hold')->default(false));
        Schema::create('linehaul_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('linehaul_trip_id')->constrained();
            $table->foreignUuid('shipment_id')->constrained();
            $table->foreignUuid('recorded_by')->constrained('users');
            $table->string('reference');
            $table->string('condition');
            $table->string('source');
            $table->timestampTz('captured_at');
            $table->timestampTz('committed_at');
            $table->json('result');
            $table->unique(['linehaul_trip_id', 'shipment_id']);
        });
        Schema::create('linehaul_discrepancies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('linehaul_trip_id')->constrained();
            $table->foreignUuid('shipment_id')->nullable()->constrained();
            $table->string('reference');
            $table->string('kind');
            $table->foreignUuid('recorded_by')->constrained('users');
            $table->text('reason')->nullable();
            $table->timestampTz('created_at');
            $table->timestampTz('resolved_at')->nullable();
            $table->foreignUuid('resolved_by')->nullable()->constrained('users');
            $table->text('resolution_reason')->nullable();
            $table->unique(['linehaul_trip_id', 'kind', 'reference'], 'linehaul_discrepancy_identity');
        });
        Schema::create('linehaul_receiving_actions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('linehaul_trip_id')->constrained();
            $table->foreignUuid('actor_id')->constrained('users');
            $table->uuid('client_id');
            $table->string('operation');
            $table->string('request_hash', 64);
            $table->json('payload');
            $table->json('result');
            $table->timestampTz('committed_at');
            $table->unique(['actor_id', 'client_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('linehaul_receiving_actions');
        Schema::dropIfExists('linehaul_discrepancies');
        Schema::dropIfExists('linehaul_receipts');
        Schema::table('shipments', fn (Blueprint $table) => $table->dropColumn('condition_hold'));
        Schema::table('linehaul_trips', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('arrived_by');
            $table->dropConstrainedForeignId('unloading_closed_by');
            $table->dropColumn(['arrived_at', 'unloading_closed_at', 'unloading_outcome']);
        });
    }
};
