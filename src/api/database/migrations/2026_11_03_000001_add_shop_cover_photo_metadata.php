<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shops', function (Blueprint $table): void {
            $table->string('banner_disk')->nullable();
            $table->string('banner_mime', 80)->nullable();
            $table->unsignedBigInteger('banner_size')->nullable();
            $table->unsignedInteger('banner_width')->nullable();
            $table->unsignedInteger('banner_height')->nullable();
            $table->uuid('banner_version')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('shops', function (Blueprint $table): void {
            $table->dropColumn(['banner_disk', 'banner_mime', 'banner_size', 'banner_width', 'banner_height', 'banner_version']);
        });
    }
};
