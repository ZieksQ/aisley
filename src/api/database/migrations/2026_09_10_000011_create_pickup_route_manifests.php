<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('address_coordinate_defaults', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('country', 100);
            $table->string('region', 160);
            $table->string('province', 160);
            $table->string('city_municipality', 160);
            $table->string('barangay', 160);
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['country', 'region', 'province', 'city_municipality', 'barangay'], 'address_coordinate_defaults_area_unique');
        });

        Schema::create('pickup_route_manifests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('pickup_schedule_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('schedule_revision');
            $table->string('status', 32)->default('pending');
            $table->string('coordinate_source', 32)->nullable();
            $table->string('coordinate_fingerprint', 64)->nullable();
            $table->unsignedInteger('estimated_credits')->default(0);
            $table->unsignedInteger('total_distance_metres')->nullable();
            $table->unsignedInteger('total_duration_seconds')->nullable();
            $table->json('stops')->nullable();
            $table->json('geojson')->nullable();
            $table->string('failure_reason', 64)->nullable();
            $table->timestamp('calculated_at')->nullable();
            $table->timestamps();
            $table->unique(['pickup_schedule_id', 'schedule_revision']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pickup_route_manifests');
        Schema::dropIfExists('address_coordinate_defaults');
    }
};
