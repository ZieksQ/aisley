<?php

use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('courier_profile_id')
                ->constrained('courier_profiles')
                ->cascadeOnDelete();
            $table->string('plate_number')->unique();
            $table->string('type')->default(VehicleType::Motorcycle->value);
            $table->string('status')->default(VehicleStatus::Active->value);
            $table->string('make')->nullable();
            $table->string('model')->nullable();
            $table->decimal('capacity', 10, 2)->nullable();
            $table->text('registration_document_path')->nullable();
            $table->timestamps();

            $table->index(['courier_profile_id', 'status']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
