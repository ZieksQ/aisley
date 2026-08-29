<?php

use App\Enums\ProductVariantStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->text('description_markdown')->nullable()->after('short_description');
            $table->jsonb('specifications')->nullable()->after('description_markdown');
        });

        Schema::create('product_option_groups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('position');

            $table->unique(['product_id', 'position']);
        });

        Schema::create('product_option_values', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('option_group_id')->constrained('product_option_groups')->cascadeOnDelete();
            $table->string('value');
            $table->string('swatch_color', 32)->nullable();
            $table->text('swatch_image_path')->nullable();
            $table->unsignedInteger('position');

            $table->unique(['option_group_id', 'value']);
            $table->unique(['option_group_id', 'position']);
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->string('sku')->unique();
            $table->decimal('price', 12, 2)->nullable();
            $table->decimal('original_price', 12, 2)->nullable();
            $table->unsignedBigInteger('stock_quantity')->default(0);
            $table->string('status')->default(ProductVariantStatus::Active->value);
            $table->uuid('primary_media_id')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'status']);
            $table->index('primary_media_id');
        });

        Schema::create('product_variant_option_values', function (Blueprint $table) {
            $table->foreignUuid('product_variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->foreignUuid('product_option_value_id')->constrained('product_option_values')->cascadeOnDelete();

            $table->primary(['product_variant_id', 'product_option_value_id'], 'product_variant_option_values_pk');
        });

        Schema::create('product_media', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('disk')->default('public');
            $table->text('path');
            $table->string('alt_text')->nullable();
            $table->unsignedInteger('position');
            $table->timestamps();

            $table->unique(['product_id', 'position']);
            $table->index(['product_variant_id', 'position']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->foreign('primary_media_id')->references('id')->on('product_media')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropForeign(['primary_media_id']);
        });

        Schema::dropIfExists('product_media');
        Schema::dropIfExists('product_variant_option_values');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('product_option_values');
        Schema::dropIfExists('product_option_groups');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['description_markdown', 'specifications']);
        });
    }
};
