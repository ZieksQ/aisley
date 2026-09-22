<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_logistics_affiliations', function (Blueprint $table): void {
            $table->boolean('can_drive_company_truck')->default(false);
            $table->unsignedInteger('truck_driver_revision')->default(1);
        });

        Schema::create('company_trucks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('home_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->string('plate_number', 64)->unique();
            $table->string('make')->nullable();
            $table->string('model')->nullable();
            $table->unsignedInteger('max_parcels');
            $table->boolean('is_active')->default(true);
            $table->string('availability', 32)->default('available');
            $table->foreignUuid('last_confirmed_hub_id')->nullable()->constrained('logistics_hubs')->restrictOnDelete();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
            $table->index(['logistics_organization_id', 'is_active']);
            $table->index(['home_hub_id', 'availability']);
        });

        Schema::create('linehaul_trips', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('owner_logistics_organization_id')->constrained('logistics_organizations')->restrictOnDelete();
            $table->foreignUuid('home_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('from_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('to_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('company_truck_id')->constrained('company_trucks')->restrictOnDelete();
            $table->foreignUuid('driver_id')->constrained('users')->restrictOnDelete();
            $table->uuid('parent_trip_id')->nullable();
            $table->foreignUuid('linehaul_manifest_id')->nullable()->unique()->constrained('linehaul_manifests')->restrictOnDelete();
            $table->foreignUuid('requested_by')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('decided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('direction', 16);
            $table->string('status', 32);
            $table->timestamp('scheduled_for');
            $table->unsignedInteger('capacity_snapshot');
            $table->unsignedInteger('parcel_count')->default(0);
            $table->string('rejection_reason', 500)->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('departed_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->timestamps();
            $table->unique(['requested_by', 'idempotency_key']);
            $table->unique('parent_trip_id');
            $table->index(['from_hub_id', 'status', 'scheduled_for']);
            $table->index(['to_hub_id', 'status', 'scheduled_for']);
            $table->index(['driver_id', 'status']);
            $table->index(['company_truck_id', 'status']);
        });

        // PostgreSQL must see the completed primary-key constraint before a new
        // table can reference itself. Adding this foreign key inside the create
        // blueprint can otherwise be compiled before the primary key exists.
        Schema::table('linehaul_trips', function (Blueprint $table): void {
            $table->foreign('parent_trip_id')->references('id')->on('linehaul_trips')->restrictOnDelete();
        });

        Schema::create('linehaul_trip_shipments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('linehaul_trip_id')->constrained('linehaul_trips')->cascadeOnDelete();
            $table->foreignUuid('shipment_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('shipment_route_hop_id')->constrained('shipment_route_hops')->restrictOnDelete();
            $table->unsignedSmallInteger('sequence');
            $table->unsignedInteger('shipment_revision_reserved');
            $table->unsignedInteger('hop_revision_reserved');
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->unique(['linehaul_trip_id', 'shipment_id']);
            $table->unique(['linehaul_trip_id', 'shipment_route_hop_id']);
            $table->unique(['linehaul_trip_id', 'sequence']);
            $table->index(['shipment_route_hop_id', 'released_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('linehaul_trip_shipments');
        Schema::dropIfExists('linehaul_trips');
        Schema::dropIfExists('company_trucks');
        Schema::table('courier_logistics_affiliations', function (Blueprint $table): void {
            $table->dropColumn(['can_drive_company_truck', 'truck_driver_revision']);
        });
    }
};
