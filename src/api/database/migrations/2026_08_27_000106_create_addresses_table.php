<?php

use App\Enums\AddressType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32)->default(AddressType::Shipping->value);
            $table->string('label')->nullable();
            $table->string('recipient_name');
            $table->string('contact_number', 32);
            $table->string('address_line_1');
            $table->string('address_line_2')->nullable();
            $table->string('barangay');
            $table->string('city_municipality');
            $table->string('province');
            $table->string('region');
            $table->string('postal_code', 10);
            $table->string('country')->default('Philippines');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'type']);
            $table->index(['user_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
    }
};
