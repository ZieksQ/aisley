<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_profiles', function (Blueprint $table): void {
            $table->string('id_image_disk')->nullable();
            $table->text('id_image_path')->nullable();
            $table->string('id_image_mime', 127)->nullable();
            $table->unsignedBigInteger('id_image_size')->nullable();
            $table->unsignedInteger('id_image_width')->nullable();
            $table->unsignedInteger('id_image_height')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('customer_profiles', function (Blueprint $table): void {
            $table->dropColumn([
                'id_image_disk',
                'id_image_path',
                'id_image_mime',
                'id_image_size',
                'id_image_width',
                'id_image_height',
            ]);
        });
    }
};
