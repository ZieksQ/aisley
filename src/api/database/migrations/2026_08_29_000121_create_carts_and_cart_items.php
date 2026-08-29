<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('cart_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('cart_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();

            $table->index(['cart_id', 'created_at']);
            $table->index(['product_id', 'variant_id']);
        });

        DB::statement(
            'CREATE UNIQUE INDEX cart_items_variant_configuration_unique '
            .'ON cart_items (cart_id, product_id, variant_id) WHERE variant_id IS NOT NULL'
        );
        DB::statement(
            'CREATE UNIQUE INDEX cart_items_product_configuration_unique '
            .'ON cart_items (cart_id, product_id) WHERE variant_id IS NULL'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('carts');
    }
};
