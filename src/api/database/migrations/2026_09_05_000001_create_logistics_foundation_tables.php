<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('logistics_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('middle_name')->nullable();
            $table->string('contact_number', 32);
            $table->string('sex', 32);
            $table->date('birth_date');
            $table->timestamps();
        });

        Schema::create('logistics_organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('business_name');
            $table->timestamps();
        });

        Schema::create('logistics_hubs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignUuid('address_id')->unique()->constrained()->restrictOnDelete();
            $table->string('name');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_hubs');
        Schema::dropIfExists('logistics_organizations');
        Schema::dropIfExists('logistics_profiles');
    }
};
