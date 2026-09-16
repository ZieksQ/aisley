<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table): void {
            $table->foreignUuid('sorting_lane_id')->nullable()->constrained('sorting_lanes')->restrictOnDelete();
            $table->foreignUuid('sorting_session_id')->nullable()->constrained('sorting_sessions')->restrictOnDelete();
            $table->timestampTz('received_at_hub_at')->nullable();
            $table->index(['logistics_hub_id', 'status', 'sorting_lane_id']);
        });
        Schema::table('dispatch_schedule_shipments', function (Blueprint $table): void {
            $table->json('source_lane')->nullable();
            $table->uuid('sorting_session_id')->nullable();
            $table->unsignedInteger('shipment_revision_at_dispatch')->nullable();
        });
        DB::table('shipments')->orderBy('id')->chunkById(100, function ($shipments): void {
            foreach ($shipments as $shipment) {
                $receipt = DB::table('shipment_events')->where('shipment_id', $shipment->id)->where('to_state', 'received_at_hub')->orderBy('occurred_at')->first();
                $item = DB::table('sorting_session_items')->where('shipment_id', $shipment->id)->where('status', 'sorted')->orderByDesc('completed_at')->first();
                DB::table('shipments')->where('id', $shipment->id)->update([
                    'received_at_hub_at' => $receipt?->occurred_at,
                    'sorting_lane_id' => in_array($shipment->status, ['sorted_at_hub', 'dispatched_from_hub', 'delivery_assigned', 'delivery_accepted'], true) ? $item?->sorting_lane_id : null,
                    'sorting_session_id' => $item?->sorting_session_id,
                ]);
                if ($item !== null) {
                    $lane = DB::table('sorting_lanes')->where('id', $item->sorting_lane_id)->first();
                    if ($lane !== null) {
                        DB::table('dispatch_schedule_shipments')->where('shipment_id', $shipment->id)->update([
                            'source_lane' => json_encode(['id' => $lane->id, 'code' => $lane->code, 'name' => $lane->name, 'revision' => $lane->revision, 'historical_backfill' => true]),
                            'sorting_session_id' => $item->sorting_session_id,
                        ]);
                    }
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_schedule_shipments', fn (Blueprint $table) => $table->dropColumn(['source_lane', 'sorting_session_id', 'shipment_revision_at_dispatch']));
        Schema::table('shipments', function (Blueprint $table): void {
            $table->dropForeign(['sorting_lane_id']);
            $table->dropForeign(['sorting_session_id']);
            $table->dropIndex(['logistics_hub_id', 'status', 'sorting_lane_id']);
            $table->dropColumn(['sorting_lane_id', 'sorting_session_id', 'received_at_hub_at']);
        });
    }
};
