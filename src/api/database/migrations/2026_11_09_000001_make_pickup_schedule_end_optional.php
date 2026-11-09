<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pickup_schedules', function (Blueprint $table) {
            $table->timestamp('ends_at')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('pickup_schedules')->whereNull('ends_at')->update(['ends_at' => DB::raw('starts_at')]);
        Schema::table('pickup_schedules', function (Blueprint $table) {
            $table->timestamp('ends_at')->nullable(false)->change();
        });
    }
};
