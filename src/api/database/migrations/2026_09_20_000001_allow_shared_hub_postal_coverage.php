<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $duplicate = DB::table('hub_service_areas')->select('logistics_hub_id', 'postal_code')
            ->groupBy('logistics_hub_id', 'postal_code')->havingRaw('COUNT(*) > 1')->exists();
        if ($duplicate) {
            throw new RuntimeException('Resolve duplicate postal coverage rows within the same hub before migrating.');
        }

        DB::statement('DROP INDEX hub_service_areas_active_postal');
        Schema::table('hub_service_areas', function (Blueprint $table): void {
            $table->unique(['logistics_hub_id', 'postal_code'], 'hub_service_areas_hub_postal_unique');
        });
    }

    public function down(): void
    {
        $shared = DB::table('hub_service_areas')->where('is_active', true)
            ->select('postal_code')->groupBy('postal_code')->havingRaw('COUNT(*) > 1')->exists();
        if ($shared) {
            throw new RuntimeException('Cannot restore exclusive postal coverage while multiple active hubs support the same code.');
        }

        Schema::table('hub_service_areas', function (Blueprint $table): void {
            $table->dropUnique('hub_service_areas_hub_postal_unique');
        });
        DB::statement('CREATE UNIQUE INDEX hub_service_areas_active_postal ON hub_service_areas (postal_code) WHERE is_active = true');
    }
};
