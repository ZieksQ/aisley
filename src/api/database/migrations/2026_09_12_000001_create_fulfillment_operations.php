<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parcels', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('waybill_id')->unique()->constrained()->restrictOnDelete();
            $table->string('reference', 64)->unique();
            $table->json('snapshot');
            $table->unsignedInteger('item_count')->default(0);
            $table->timestamps();
        });

        Schema::create('shipments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('parcel_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->string('status', 40)->default('awaiting_seller_pickup');
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
            $table->index(['logistics_organization_id', 'logistics_hub_id', 'status']);
        });

        Schema::create('delivery_tasks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('shipment_id')->constrained()->restrictOnDelete();
            $table->string('leg', 16);
            $table->string('status', 40);
            $table->foreignUuid('courier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('legacy_first_mile_task_id')->nullable()->unique()->constrained('first_mile_tasks')->nullOnDelete();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamp('in_transit_at')->nullable();
            $table->timestamp('out_for_delivery_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
            $table->unique(['shipment_id', 'leg']);
            $table->index(['courier_id', 'leg', 'status', 'created_at']);
        });

        Schema::create('delivery_task_offers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('delivery_task_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('offered_by_logistics_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('status', 16)->default('offered');
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->text('rejection_reason')->nullable();
            $table->timestamp('offered_at');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
            $table->unique(['delivery_task_id', 'sequence']);
            $table->unique(['offered_by_logistics_id', 'idempotency_key']);
            $table->index(['delivery_task_id', 'status', 'sequence']);
        });

        Schema::create('shipment_evidence', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('delivery_task_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('delivery_task_offer_id')->nullable()->constrained('delivery_task_offers')->nullOnDelete();
            $table->foreignUuid('waybill_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->string('purpose', 24);
            $table->string('type', 24);
            $table->string('safe_reference', 128)->nullable();
            $table->string('identifier_hash', 64)->nullable();
            $table->string('status', 24)->default('awaiting_validation');
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->uuid('correlation_id');
            $table->foreignUuid('validated_by_logistics_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();
            $table->unique(['courier_id', 'idempotency_key']);
            $table->index(['delivery_task_id', 'purpose', 'status', 'submitted_at']);
        });

        Schema::create('completion_intents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('delivery_task_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('shipment_evidence_id')->constrained('shipment_evidence')->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('expected_revision');
            $table->string('status', 24)->default('awaiting_validation');
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->timestamp('confirmed_at');
            $table->timestamp('validated_at')->nullable();
            $table->foreignUuid('validated_by_logistics_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['courier_id', 'idempotency_key']);
            $table->index(['delivery_task_id', 'status', 'confirmed_at']);
        });

        Schema::create('shipment_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('shipment_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('delivery_task_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('delivery_task_offer_id')->nullable()->constrained('delivery_task_offers')->nullOnDelete();
            $table->foreignUuid('shipment_evidence_id')->nullable()->constrained('shipment_evidence')->nullOnDelete();
            $table->string('event_type', 48);
            $table->string('from_state', 40)->nullable();
            $table->string('to_state', 40)->nullable();
            $table->foreignUuid('performing_courier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('recorded_by_logistics_id')->nullable()->constrained('users')->nullOnDelete();
            $table->uuid('idempotency_key')->nullable();
            $table->uuid('correlation_id');
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['shipment_id', 'occurred_at', 'id']);
            $table->index(['delivery_task_id', 'event_type', 'occurred_at']);
            $table->unique(['performing_courier_id', 'idempotency_key'], 'shipment_events_courier_idempotency_unique');
            $table->unique(['recorded_by_logistics_id', 'idempotency_key'], 'shipment_events_logistics_idempotency_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS shipment_events_append_only ON shipment_events;

                CREATE OR REPLACE FUNCTION prevent_shipment_events_mutation() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'shipment_events is append-only';
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER shipment_events_append_only
                BEFORE UPDATE OR DELETE ON shipment_events
                FOR EACH ROW EXECUTE FUNCTION prevent_shipment_events_mutation();
            SQL);
        }

        if (DB::getDriverName() === 'sqlite') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS shipment_events_prevent_update;
                DROP TRIGGER IF EXISTS shipment_events_prevent_delete;

                CREATE TRIGGER shipment_events_prevent_update
                BEFORE UPDATE ON shipment_events
                BEGIN
                    SELECT RAISE(ABORT, 'shipment_events is append-only');
                END;

                CREATE TRIGGER shipment_events_prevent_delete
                BEFORE DELETE ON shipment_events
                BEGIN
                    SELECT RAISE(ABORT, 'shipment_events is append-only');
                END;
            SQL);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS shipment_events_append_only ON shipment_events;
                DROP FUNCTION IF EXISTS prevent_shipment_events_mutation();
            SQL);
        }

        if (DB::getDriverName() === 'sqlite') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS shipment_events_prevent_update;
                DROP TRIGGER IF EXISTS shipment_events_prevent_delete;
            SQL);
        }

        Schema::dropIfExists('shipment_events');
        Schema::dropIfExists('completion_intents');
        Schema::dropIfExists('shipment_evidence');
        Schema::dropIfExists('delivery_task_offers');
        Schema::dropIfExists('delivery_tasks');
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('parcels');
    }
};
