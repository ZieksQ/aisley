<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hub_connections', function (Blueprint $table) {
            $table->boolean('sender_requested')->default(true);
            $table->boolean('receiver_accepted')->default(false);
        });
        // Existing unilateral links must also obtain receiver consent; receipts remain available.
        DB::table('hub_connections')->where('is_active', true)->update(['is_active' => false, 'revision' => DB::raw('revision + 1')]);
    }

    public function down(): void
    {
        Schema::table('hub_connections', fn (Blueprint $table) => $table->dropColumn(['sender_requested', 'receiver_accepted']));
    }
};
