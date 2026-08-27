<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flash_deals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
        });

        Schema::create('flash_deal_products', function (Blueprint $table) {
            $table->foreignUuid('flash_deal_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->decimal('deal_price', 12, 2);
            $table->unsignedBigInteger('deal_stock');
            $table->unsignedBigInteger('sold_quantity')->default(0);
            $table->timestamps();

            $table->primary(['flash_deal_id', 'product_id']);
            $table->index(['product_id', 'flash_deal_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flash_deal_products');
        Schema::dropIfExists('flash_deals');
    }
};
