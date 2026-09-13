<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_feature_controls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key', 120)->unique();
            $table->string('label', 160);
            $table->text('description')->nullable();
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('updated_by_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('enabled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_feature_controls');
    }
};
