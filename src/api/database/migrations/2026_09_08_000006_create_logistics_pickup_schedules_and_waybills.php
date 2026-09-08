<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_pickup_requests', function (Blueprint $table) {
            $table->dropForeign(['logistics_organization_id']);
        });
        Schema::table('seller_pickup_requests', function (Blueprint $table) {
            $table->foreign('logistics_organization_id')->references('id')->on('logistics_organizations')->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->nullable()->after('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->string('provider_match_tier', 32)->nullable()->after('pickup_date');
            $table->decimal('provider_distance_km', 10, 3)->nullable();
            $table->string('provider_distance_status', 32)->default('unavailable');
            $table->timestamp('provider_distance_calculated_at')->nullable();
            $table->string('provider_source_fingerprint', 64)->nullable();
            $table->string('provider_destination_fingerprint', 64)->nullable();
            $table->index(['logistics_organization_id', 'status', 'created_at'], 'pickup_requests_logistics_status_created_index');
        });

        Schema::table('seller_pickup_request_orders', function (Blueprint $table) {
            $table->unsignedSmallInteger('position')->nullable();
        });

        Schema::create('waybills', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('seller_pickup_request_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('shop_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->string('reference', 32)->unique();
            $table->string('qr_token_hash', 64)->unique();
            $table->string('status', 32)->default('active');
            $table->unsignedSmallInteger('template_version')->default(1);
            $table->unsignedSmallInteger('snapshot_schema_version')->default(1);
            $table->string('content_checksum', 64);
            $table->timestamps();
        });

        Schema::create('waybill_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('waybill_id')->unique()->constrained()->restrictOnDelete();
            $table->json('payload');
            $table->timestamps();
        });

        Schema::create('waybill_access_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('waybill_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('actor_role', 32);
            $table->string('action', 32);
            $table->uuid('correlation_id');
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['waybill_id', 'occurred_at']);
        });

        Schema::create('pickup_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->string('reference', 32)->unique();
            $table->string('status', 32)->default('scheduled');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->unsignedInteger('revision')->default(1);
            $table->uuid('idempotency_key');
            $table->timestamps();
            $table->unique(['logistics_organization_id', 'idempotency_key']);
            $table->index(['logistics_organization_id', 'status', 'starts_at']);
            $table->index(['courier_id', 'status', 'starts_at', 'ends_at']);
        });

        Schema::create('pickup_schedule_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pickup_schedule_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('seller_pickup_request_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->timestamps();
            $table->unique(['pickup_schedule_id', 'order_id']);
        });

        Schema::create('first_mile_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pickup_schedule_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('waybill_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 32)->default('assigned');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->index(['courier_id', 'status', 'created_at']);
        });

        Schema::create('pickup_schedule_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pickup_schedule_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 32);
            $table->unsignedInteger('revision');
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->text('reason')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['pickup_schedule_id', 'revision']);
        });

        Schema::create('pickup_schedule_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pickup_schedule_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('schedule_revision');
            $table->timestamp('due_at');
            $table->string('status', 32)->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
            $table->unique(['pickup_schedule_id', 'schedule_revision']);
            $table->index(['status', 'due_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE pickup_schedules ADD CONSTRAINT pickup_schedules_window_check CHECK (starts_at < ends_at)');
            DB::statement('ALTER TABLE seller_pickup_requests ADD CONSTRAINT seller_pickup_requests_distance_check CHECK (provider_distance_km IS NULL OR provider_distance_km >= 0)');
            DB::statement("CREATE UNIQUE INDEX first_mile_tasks_active_order_unique ON first_mile_tasks (order_id) WHERE status IN ('assigned', 'accepted', 'picked_up_from_seller')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pickup_schedule_reminders');
        Schema::dropIfExists('pickup_schedule_history');
        Schema::dropIfExists('first_mile_tasks');
        Schema::dropIfExists('pickup_schedule_orders');
        Schema::dropIfExists('pickup_schedules');
        Schema::dropIfExists('waybill_access_events');
        Schema::dropIfExists('waybill_snapshots');
        Schema::dropIfExists('waybills');

        Schema::table('seller_pickup_requests', function (Blueprint $table) {
            $table->dropForeign(['logistics_organization_id']);
        });
        Schema::table('seller_pickup_requests', function (Blueprint $table) {
            $table->foreign('logistics_organization_id')->references('id')->on('logistics_organizations')->nullOnDelete();
            $table->dropIndex('pickup_requests_logistics_status_created_index');
            $table->dropConstrainedForeignId('logistics_hub_id');
            $table->dropColumn([
                'provider_match_tier', 'provider_distance_km', 'provider_distance_status',
                'provider_distance_calculated_at', 'provider_source_fingerprint', 'provider_destination_fingerprint',
            ]);
        });
        Schema::table('seller_pickup_request_orders', function (Blueprint $table) {
            $table->dropColumn('position');
        });
    }
};
