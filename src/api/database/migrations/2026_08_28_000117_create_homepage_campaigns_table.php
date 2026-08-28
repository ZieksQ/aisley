<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('homepage_campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('placement', 32);
            $table->string('title');
            $table->string('image_disk')->default('public');
            $table->text('image_desktop_path');
            $table->text('image_mobile_path');
            $table->string('alt_text');
            $table->text('destination_url');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->integer('priority')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'placement', 'starts_at', 'ends_at'], 'homepage_campaign_active_window_index');
            $table->index(['placement', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('homepage_campaigns');
    }
};
