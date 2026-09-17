<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hub_service_areas', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->string('postal_code', 4);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
        DB::statement('CREATE UNIQUE INDEX hub_service_areas_active_postal ON hub_service_areas (postal_code) WHERE is_active = true');
        Schema::create('hub_connections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('from_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('to_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['from_hub_id', 'to_hub_id']);
        });
        Schema::create('shipment_routes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('waybill_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('shipment_id')->nullable()->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('origin_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('destination_hub_id')->nullable()->constrained('logistics_hubs')->restrictOnDelete();
            $table->string('status');
            $table->string('algorithm')->default('dijkstra');
            $table->string('objective')->default('duration_distance');
            $table->string('graph_revision', 64)->nullable();
            $table->double('distance_meters')->nullable();
            $table->double('duration_seconds')->nullable();
            $table->string('failure_code')->nullable();
            $table->timestamp('calculated_at')->nullable();
            $table->timestamps();
        });
        Schema::create('shipment_route_hops', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('shipment_route_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('hub_connection_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('sequence');
            $table->foreignUuid('from_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('to_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->string('status')->default('pending');
            $table->unsignedInteger('revision')->default(1);
            $table->double('distance_meters');
            $table->double('duration_seconds');
            $table->string('source_fingerprint', 64);
            $table->string('destination_fingerprint', 64);
            $table->string('provider')->default('geoapify');
            $table->string('provider_status')->default('calculated');
            $table->timestamp('metric_calculated_at');
            $table->uuid('provider_request_id');
            $table->foreignUuid('departed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignUuid('arrived_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('departed_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
            $table->json('source_lane')->nullable();
            $table->timestamps();
            $table->unique(['shipment_route_id', 'sequence']);
        });
        Schema::table('shipments', function (Blueprint $table): void {
            $table->foreignUuid('current_logistics_organization_id')->nullable()->constrained('logistics_organizations')->restrictOnDelete();
            $table->foreignUuid('current_hub_id')->nullable()->constrained('logistics_hubs')->restrictOnDelete();
            $table->index(['current_logistics_organization_id', 'current_hub_id', 'status'], 'shipments_current_scope_status');
        });
        DB::table('shipments')->update(['current_logistics_organization_id' => DB::raw('logistics_organization_id'), 'current_hub_id' => DB::raw('logistics_hub_id')]);
        Schema::table('sorting_plan_lanes', function (Blueprint $table): void {
            $table->string('postal_code', 10)->nullable()->change();
            $table->string('destination_type')->default('postal_code');
            $table->foreignUuid('destination_hub_id')->nullable()->constrained('logistics_hubs')->restrictOnDelete();
            $table->unique(['sorting_plan_id', 'destination_hub_id']);
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE hub_connections ADD CONSTRAINT hub_connections_distinct CHECK (from_hub_id <> to_hub_id)');
            DB::statement("ALTER TABLE hub_service_areas ADD CONSTRAINT hub_service_areas_postal CHECK (postal_code ~ '^[0-9]{4}$')");
            DB::statement("ALTER TABLE sorting_plan_lanes ADD CONSTRAINT sorting_plan_lanes_target CHECK ((destination_type = 'postal_code' AND postal_code IS NOT NULL AND destination_hub_id IS NULL) OR (destination_type = 'hub' AND postal_code IS NULL AND destination_hub_id IS NOT NULL))");
            DB::statement('ALTER TABLE shipment_route_hops ADD CONSTRAINT shipment_route_hops_valid CHECK (sequence > 0 AND from_hub_id <> to_hub_id AND distance_meters >= 0 AND duration_seconds >= 0)');
        } else {
            // SQLite cannot add CHECK constraints to an existing table without rebuilding it.
            foreach (['INSERT', 'UPDATE'] as $operation) {
                $suffix = strtolower($operation);
                DB::unprepared("CREATE TRIGGER hub_service_areas_postal_$suffix BEFORE $operation ON hub_service_areas WHEN length(NEW.postal_code) <> 4 OR NEW.postal_code GLOB '*[^0-9]*' BEGIN SELECT RAISE(ABORT, 'Invalid postal code'); END");
                DB::unprepared("CREATE TRIGGER shipment_route_hops_valid_$suffix BEFORE $operation ON shipment_route_hops WHEN NEW.sequence < 1 OR NEW.from_hub_id = NEW.to_hub_id OR NEW.distance_meters < 0 OR NEW.duration_seconds < 0 BEGIN SELECT RAISE(ABORT, 'Invalid route hop'); END");
                DB::unprepared("CREATE TRIGGER hub_connections_distinct_$suffix BEFORE $operation ON hub_connections WHEN NEW.from_hub_id = NEW.to_hub_id BEGIN SELECT RAISE(ABORT, 'Hub endpoints must differ'); END");
                DB::unprepared("CREATE TRIGGER sorting_plan_lanes_target_$suffix BEFORE $operation ON sorting_plan_lanes WHEN NOT ((NEW.destination_type = 'postal_code' AND NEW.postal_code IS NOT NULL AND NEW.destination_hub_id IS NULL) OR (NEW.destination_type = 'hub' AND NEW.postal_code IS NULL AND NEW.destination_hub_id IS NOT NULL)) BEGIN SELECT RAISE(ABORT, 'Invalid lane destination'); END");
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE sorting_plan_lanes DROP CONSTRAINT sorting_plan_lanes_target');
        } else {
            DB::unprepared('DROP TRIGGER IF EXISTS sorting_plan_lanes_target_insert');
            DB::unprepared('DROP TRIGGER IF EXISTS sorting_plan_lanes_target_update');
        }
        Schema::table('sorting_plan_lanes', function (Blueprint $table): void {
            $table->dropUnique(['sorting_plan_id', 'destination_hub_id']);
            $table->dropConstrainedForeignId('destination_hub_id');
            $table->dropColumn('destination_type');
        });
        Schema::table('shipments', function (Blueprint $table): void {
            $table->dropIndex('shipments_current_scope_status');
            $table->dropConstrainedForeignId('current_hub_id');
            $table->dropConstrainedForeignId('current_logistics_organization_id');
        });
        Schema::dropIfExists('shipment_route_hops');
        Schema::dropIfExists('shipment_routes');
        Schema::dropIfExists('hub_connections');
        Schema::dropIfExists('hub_service_areas');
    }
};
