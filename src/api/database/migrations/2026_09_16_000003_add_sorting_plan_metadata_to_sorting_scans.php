<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sorting_scans', function (Blueprint $table): void {
            $table->foreignUuid('sorting_plan_id')->nullable()->after('sorting_lane_id')->constrained('sorting_plans')->nullOnDelete();
            $table->foreignUuid('sorting_plan_lane_id')->nullable()->after('sorting_plan_id')->constrained('sorting_plan_lanes')->nullOnDelete();
            $table->index(['sorting_plan_id', 'sorting_plan_lane_id']);
        });
    }

    public function down(): void
    {
        Schema::table('sorting_scans', function (Blueprint $table): void {
            $table->dropForeign(['sorting_plan_lane_id']);
            $table->dropForeign(['sorting_plan_id']);
            $table->dropIndex(['sorting_plan_id', 'sorting_plan_lane_id']);
            $table->dropColumn(['sorting_plan_id', 'sorting_plan_lane_id']);
        });
    }
};
