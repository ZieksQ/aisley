<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sorting_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('created_by_logistics_id')->constrained('users')->restrictOnDelete();
            $table->string('name', 80);
            $table->boolean('is_active')->default(false);
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
            $table->unique(['logistics_organization_id', 'logistics_hub_id', 'name']);
            $table->index(['logistics_organization_id', 'logistics_hub_id', 'is_active']);
        });

        Schema::create('sorting_plan_lanes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('sorting_plan_id')->constrained('sorting_plans')->cascadeOnDelete();
            $table->foreignUuid('sorting_lane_id')->constrained('sorting_lanes')->restrictOnDelete();
            $table->string('postal_code', 10);
            $table->unsignedSmallInteger('position')->default(1);
            $table->timestamps();
            $table->unique(['sorting_plan_id', 'postal_code']);
            $table->index(['sorting_plan_id', 'position']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            Schema::getConnection()->statement(
                'CREATE UNIQUE INDEX sorting_plans_one_active_per_hub ON sorting_plans (logistics_organization_id, logistics_hub_id) WHERE is_active = true'
            );
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            Schema::getConnection()->statement('DROP INDEX IF EXISTS sorting_plans_one_active_per_hub');
        }
        Schema::dropIfExists('sorting_plan_lanes');
        Schema::dropIfExists('sorting_plans');
    }
};
