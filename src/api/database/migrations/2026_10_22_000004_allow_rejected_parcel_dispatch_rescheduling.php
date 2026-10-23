<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_schedule_shipments', function (Blueprint $table): void {
            $table->dropUnique(['shipment_id']);
            $table->dropUnique(['delivery_task_id']);
            $table->unique(['dispatch_schedule_id', 'shipment_id'], 'dispatch_members_schedule_shipment_unique');
            $table->unique(['dispatch_schedule_id', 'delivery_task_id'], 'dispatch_members_schedule_task_unique');
            $table->index(['delivery_task_id', 'created_at'], 'dispatch_members_task_created_index');
        });
    }

    public function down(): void
    {
        // Restoring lifetime uniqueness must never discard dispatch history.
        if (DB::table('dispatch_schedule_shipments')->select('shipment_id')->groupBy('shipment_id')->havingRaw('COUNT(*) > 1')->exists()
            || DB::table('dispatch_schedule_shipments')->select('delivery_task_id')->groupBy('delivery_task_id')->havingRaw('COUNT(*) > 1')->exists()) {
            throw new LogicException('Cannot roll back dispatch rescheduling while historical memberships exist.');
        }
        Schema::table('dispatch_schedule_shipments', function (Blueprint $table): void {
            $table->dropUnique('dispatch_members_schedule_shipment_unique');
            $table->dropUnique('dispatch_members_schedule_task_unique');
            $table->dropIndex('dispatch_members_task_created_index');
            $table->unique('shipment_id');
            $table->unique('delivery_task_id');
        });
    }
};
