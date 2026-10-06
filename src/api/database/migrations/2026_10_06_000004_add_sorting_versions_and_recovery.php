<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sorting_plans', function (Blueprint $table): void {
            $table->uuid('active_version_id')->nullable();
            $table->boolean('draft_dirty')->default(true);
            $table->timestampTz('archived_at')->nullable();
        });
        Schema::table('sorting_lanes', function (Blueprint $table): void {
            $table->string('operational_state', 16)->default('open');
            $table->text('blocking_reason')->nullable();
            $table->uuid('state_changed_by')->nullable();
            $table->timestampTz('state_changed_at')->nullable();
        });
        Schema::create('sorting_plan_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('sorting_plan_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('number');
            $table->string('name', 80);
            $table->json('mappings');
            $table->json('differences');
            $table->foreignUuid('published_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('published_at');
            $table->unique(['sorting_plan_id', 'number']);
        });
        Schema::create('sorting_plan_activations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('sorting_plan_version_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('requested_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('scheduled_for');
            $table->string('status', 16)->default('scheduled');
            $table->string('pending_key')->nullable()->unique();
            $table->text('failure_reason')->nullable();
            $table->foreignUuid('cancelled_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'scheduled_for']);
        });
        Schema::create('sorting_mutations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('actor_id')->constrained('users')->restrictOnDelete();
            $table->uuid('client_id');
            $table->string('request_hash', 64);
            $table->json('result');
            $table->timestampTz('created_at');
            $table->unique(['actor_id', 'client_id']);
        });
        Schema::create('sorting_exceptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('shipment_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('sorting_lane_id')->constrained()->restrictOnDelete();
            $table->string('open_key')->nullable()->unique();
            $table->string('exception_code', 40);
            $table->string('cause', 80);
            $table->text('reason')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('recorded_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('recorded_at');
            $table->timestampTz('last_attempt_at');
            $table->text('inspection_reason')->nullable();
            $table->foreignUuid('released_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('released_at')->nullable();
            $table->foreignUuid('resolved_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('resolved_at')->nullable();
            $table->uuid('resolution_scan_id')->nullable();
            $table->index(['logistics_hub_id', 'resolved_at']);
        });
        Schema::table('linehaul_trip_shipments', fn (Blueprint $table) => $table->json('sorting_assignment')->nullable());
        Schema::table('shipments', fn (Blueprint $table) => $table->json('sorting_assignment')->nullable());
        Schema::table('sorting_session_items', fn (Blueprint $table) => $table->json('assignment_snapshot')->nullable());
        Schema::table('sorting_scans', function (Blueprint $table): void {
            $table->uuid('sorting_plan_version_id')->nullable();
            $table->json('assignment_snapshot')->nullable();
            $table->json('result_snapshot')->nullable();
        });
        // Import the current configuration, without pretending it is historical evidence.
        foreach (DB::table('sorting_plans')->orderBy('id')->get() as $plan) {
            $id = (string) Str::uuid();
            $mappings = DB::table('sorting_plan_lanes')->where('sorting_plan_id', $plan->id)->orderBy('position')->orderBy('id')->get()->map(fn ($row) => [
                'id' => $row->id, 'sorting_lane_id' => $row->sorting_lane_id,
                'postal_code' => $row->postal_code, 'destination_type' => $row->destination_type,
                'destination_hub_id' => $row->destination_hub_id, 'position' => $row->position,
            ])->all();
            DB::table('sorting_plan_versions')->insert(['id' => $id, 'sorting_plan_id' => $plan->id,
                'number' => 1, 'name' => $plan->name, 'mappings' => json_encode($mappings),
                'differences' => json_encode(['legacy_import' => true]), 'published_by' => $plan->created_by_logistics_id,
                'published_at' => now()]);
            DB::table('sorting_plans')->where('id', $plan->id)->update(['draft_dirty' => false, 'active_version_id' => $plan->is_active ? $id : null]);
        }
        foreach (DB::table('shipments')->whereNotNull('sorting_lane_id')->get() as $shipment) {
            DB::table('shipments')->where('id', $shipment->id)->update(['sorting_assignment' => json_encode([
                'legacy_reconstructed' => true, 'lane' => ['id' => $shipment->sorting_lane_id, 'code' => null, 'name' => null],
                'version_id' => null, 'assigned_at' => null,
            ])]);
        }
        foreach (DB::table('sorting_session_items')->whereNotNull('sorting_lane_id')->get() as $item) {
            DB::table('sorting_session_items')->where('id', $item->id)->update(['assignment_snapshot' => json_encode([
                'legacy_reconstructed' => true, 'version_id' => null,
                'lane' => ['id' => $item->sorting_lane_id, 'code' => null, 'name' => null],
            ])]);
        }
        foreach (DB::table('sorting_scans')->get() as $scan) {
            $assignment = ['legacy_reconstructed' => true, 'version_id' => null, 'version_number' => null,
                'lane' => ['id' => $scan->sorting_lane_id, 'code' => null, 'name' => null], 'assigned_at' => null];
            $result = ['client_id' => $scan->client_id, 'reference' => $scan->reference, 'status' => $scan->outcome,
                'lane' => $assignment['lane'], 'sorting_assignment' => $assignment, 'version_id' => null,
                'automatic' => (bool) $scan->automatic_routing, 'sort_plan_id' => $scan->sorting_plan_id,
                'sort_plan_lane_id' => $scan->sorting_plan_lane_id, 'shipment_id' => $scan->shipment_id,
                'processed_at' => $scan->processed_at, 'exception_code' => $scan->exception_code, 'reason' => $scan->reason];
            DB::table('sorting_scans')->where('id', $scan->id)->update(['assignment_snapshot' => json_encode($assignment), 'result_snapshot' => json_encode($result)]);
        }
        foreach (DB::table('sorting_session_items')->where('status', 'exception')->whereNull('exception_resolved_at')->orderBy('created_at')->get() as $item) {
            $session = DB::table('sorting_sessions')->where('id', $item->sorting_session_id)->first();
            $shipment = DB::table('shipments')->where('id', $item->shipment_id)->first();
            if (! $session || ! $shipment || ! $item->sorting_lane_id || $shipment->current_hub_id !== $session->logistics_hub_id || $shipment->status !== 'received_at_hub') {
                continue;
            }
            $key = $shipment->id.':'.$session->logistics_hub_id;
            if (DB::table('sorting_exceptions')->where('open_key', $key)->exists()) {
                continue;
            }
            DB::table('sorting_exceptions')->insert(['id' => (string) Str::uuid(), 'shipment_id' => $shipment->id,
                'logistics_organization_id' => $session->logistics_organization_id, 'logistics_hub_id' => $session->logistics_hub_id,
                'sorting_lane_id' => $item->sorting_lane_id, 'open_key' => $key, 'exception_code' => $item->exception_code,
                'cause' => 'legacy_exception', 'reason' => $item->exception_reason, 'attempts' => 1, 'revision' => 1,
                'recorded_by' => $session->opened_by_logistics_id, 'recorded_at' => $item->exception_recorded_at ?? now(),
                'last_attempt_at' => $item->exception_recorded_at ?? now()]);
        }
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared("CREATE OR REPLACE FUNCTION reject_sorting_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Published sorting versions are immutable'; END; $$");
            DB::unprepared('CREATE TRIGGER sorting_versions_immutable BEFORE UPDATE OR DELETE ON sorting_plan_versions FOR EACH ROW EXECUTE FUNCTION reject_sorting_version_mutation()');
        } elseif (DB::getDriverName() === 'sqlite') {
            DB::unprepared("CREATE TRIGGER sorting_versions_no_update BEFORE UPDATE ON sorting_plan_versions BEGIN SELECT RAISE(ABORT, 'Published sorting versions are immutable'); END");
            DB::unprepared("CREATE TRIGGER sorting_versions_no_delete BEFORE DELETE ON sorting_plan_versions BEGIN SELECT RAISE(ABORT, 'Published sorting versions are immutable'); END");
        }

    }

    public function down(): void
    {
        Schema::table('sorting_scans', fn (Blueprint $table) => $table->dropColumn(['sorting_plan_version_id', 'assignment_snapshot', 'result_snapshot']));
        Schema::table('linehaul_trip_shipments', fn (Blueprint $table) => $table->dropColumn('sorting_assignment'));
        Schema::table('shipments', fn (Blueprint $table) => $table->dropColumn('sorting_assignment'));
        Schema::table('sorting_session_items', fn (Blueprint $table) => $table->dropColumn('assignment_snapshot'));
        Schema::dropIfExists('sorting_exceptions');
        Schema::dropIfExists('sorting_mutations');
        Schema::dropIfExists('sorting_plan_activations');
        Schema::dropIfExists('sorting_plan_versions');
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP FUNCTION IF EXISTS reject_sorting_version_mutation()');
        }
        Schema::table('sorting_lanes', fn (Blueprint $table) => $table->dropColumn(['operational_state', 'blocking_reason', 'state_changed_by', 'state_changed_at']));
        Schema::table('sorting_plans', fn (Blueprint $table) => $table->dropColumn(['active_version_id', 'draft_dirty', 'archived_at']));
    }
};
