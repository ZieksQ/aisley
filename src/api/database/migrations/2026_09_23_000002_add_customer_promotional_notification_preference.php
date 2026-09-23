<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_profiles', function (Blueprint $table): void {
            $table->boolean('promotional_in_app_opted_in')->default(false);
            $table->timestamp('promotional_in_app_opted_in_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('customer_profiles', function (Blueprint $table): void {
            $table->dropColumn(['promotional_in_app_opted_in', 'promotional_in_app_opted_in_at']);
        });
    }
};
