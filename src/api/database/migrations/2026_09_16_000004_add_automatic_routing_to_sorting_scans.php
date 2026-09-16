<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sorting_scans', function (Blueprint $table): void {
            $table->boolean('automatic_routing')->default(false)->after('sorting_plan_lane_id');
            $table->index(['automatic_routing', 'sorting_plan_id']);
        });
    }

    public function down(): void
    {
        Schema::table('sorting_scans', function (Blueprint $table): void {
            $table->dropIndex(['automatic_routing', 'sorting_plan_id']);
            $table->dropColumn('automatic_routing');
        });
    }
};
