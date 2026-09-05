<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('homepage_advertisement_configurations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('source_configuration_id')->nullable()->index();
            $table->string('layout', 32);
            $table->unsignedSmallInteger('rotation_interval_seconds')->default(6);
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('created_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('published_by_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'published_at']);
        });
        Schema::table('homepage_campaigns', function (Blueprint $table) {
            $table->foreignUuid('homepage_advertisement_configuration_id')->nullable()->after('id')->constrained('homepage_advertisement_configurations')->nullOnDelete();
            $table->string('slot', 24)->nullable()->after('placement');
            $table->text('description')->nullable()->after('title');
            $table->unsignedSmallInteger('position')->default(0)->after('priority');
            $table->index(['homepage_advertisement_configuration_id', 'slot', 'position'], 'homepage_ad_configuration_slot_position_index');
        });
    }
    public function down(): void
    {
        Schema::table('homepage_campaigns', function (Blueprint $table) {
            $table->dropIndex('homepage_ad_configuration_slot_position_index');
            $table->dropConstrainedForeignId('homepage_advertisement_configuration_id');
            $table->dropColumn(['slot', 'description', 'position']);
        });
        Schema::dropIfExists('homepage_advertisement_configurations');
    }
};
