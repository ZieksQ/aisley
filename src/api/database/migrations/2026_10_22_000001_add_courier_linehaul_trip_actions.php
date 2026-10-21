<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('linehaul_trips', function (Blueprint $table): void {
            $table->timestamp('released_for_departure_at')->nullable();
            $table->foreignUuid('released_for_departure_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignUuid('departed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('courier_arrived_at')->nullable();
            $table->foreignUuid('courier_arrived_by')->nullable()->constrained('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('linehaul_trips', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('released_for_departure_by');
            $table->dropConstrainedForeignId('departed_by');
            $table->dropConstrainedForeignId('courier_arrived_by');
            $table->dropColumn(['released_for_departure_at', 'courier_arrived_at']);
        });
    }
};
