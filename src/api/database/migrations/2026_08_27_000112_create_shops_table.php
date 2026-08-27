<?php

use App\Enums\ShopStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shops', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('seller_id')
                ->unique()
                ->constrained('users')
                ->restrictOnDelete();
            $table->foreignUuid('shop_category_id')
                ->nullable()
                ->constrained('shop_categories')
                ->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('status')->default(ShopStatus::Active->value);
            $table->string('contact_email')->nullable();
            $table->string('contact_number')->nullable();
            $table->string('website')->nullable();
            $table->text('logo_path')->nullable();
            $table->text('banner_path')->nullable();
            $table->boolean('is_on_vacation')->default(false);
            $table->text('vacation_message')->nullable();
            $table->timestamps();

            $table->index('shop_category_id');
            $table->index(['status', 'is_on_vacation']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shops');
    }
};
