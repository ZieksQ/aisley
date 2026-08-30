<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_profiles', function (Blueprint $table) {
            $table->string('profile_photo_disk')->nullable()->after('profile_photo_path');
            $table->string('profile_photo_mime', 64)->nullable()->after('profile_photo_disk');
            $table->unsignedBigInteger('profile_photo_size')->nullable()->after('profile_photo_mime');
            $table->unsignedInteger('profile_photo_width')->nullable()->after('profile_photo_size');
            $table->unsignedInteger('profile_photo_height')->nullable()->after('profile_photo_width');
        });
    }

    public function down(): void
    {
        Schema::table('admin_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'profile_photo_disk',
                'profile_photo_mime',
                'profile_photo_size',
                'profile_photo_width',
                'profile_photo_height',
            ]);
        });
    }
};
