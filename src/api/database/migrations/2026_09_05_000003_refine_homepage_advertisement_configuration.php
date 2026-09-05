<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('homepage_advertisement_configurations', function (Blueprint $table) {
            $table->string('tag_title', 120)->nullable()->after('source_configuration_id');
            $table->timestampTz('starts_at')->nullable()->after('rotation_interval_seconds');
            $table->timestampTz('ends_at')->nullable()->after('starts_at');
            $table->index(['status', 'starts_at', 'ends_at'], 'homepage_ad_configuration_schedule_index');
        });

        Schema::table('homepage_campaigns', function (Blueprint $table) {
            $table->string('image_desktop_filename')->nullable()->after('image_desktop_path');
            $table->string('image_mobile_filename')->nullable()->after('image_mobile_path');
        });
    }

    public function down(): void
    {
        Schema::table('homepage_campaigns', function (Blueprint $table) {
            $table->dropColumn(['image_desktop_filename', 'image_mobile_filename']);
        });

        Schema::table('homepage_advertisement_configurations', function (Blueprint $table) {
            $table->dropIndex('homepage_ad_configuration_schedule_index');
            $table->dropColumn(['tag_title', 'starts_at', 'ends_at']);
        });
    }
};
