<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('base_sku')->nullable()->after('slug');
            $table->string('currency', 3)->default('PHP')->after('original_price');
            $table->timestamp('purge_after')->nullable()->index();
            $table->softDeletes();
        });
        DB::table('products')->update([
            'base_sku' => DB::raw('(SELECT inventory_skus.code FROM inventory_skus WHERE inventory_skus.product_id = products.id AND inventory_skus.is_base = true LIMIT 1)'),
        ]);
        DB::table('products')->whereNull('base_sku')->orderBy('id')->each(function (object $product): void {
            DB::table('products')->where('id', $product->id)->update([
                'base_sku' => 'BASE-'.strtoupper(substr(str_replace('-', '', (string) $product->id), 0, 12)),
            ]);
        });
        Schema::table('products', function (Blueprint $table) {
            $table->unique(['shop_id', 'base_sku']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->foreignUuid('shop_id')->nullable()->after('product_id')->constrained('shops')->restrictOnDelete();
        });
        DB::table('product_variants')->update([
            'shop_id' => DB::raw('(SELECT products.shop_id FROM products WHERE products.id = product_variants.product_id)'),
        ]);
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropUnique('product_variants_sku_unique');
            $table->unique(['shop_id', 'sku']);
        });

        Schema::table('inventory_skus', function (Blueprint $table) {
            $table->foreignUuid('shop_id')->nullable()->after('product_id')->constrained('shops')->restrictOnDelete();
        });
        DB::table('inventory_skus')->update([
            'shop_id' => DB::raw('(SELECT products.shop_id FROM products WHERE products.id = inventory_skus.product_id)'),
        ]);
        Schema::table('inventory_skus', function (Blueprint $table) {
            $table->dropUnique('inventory_skus_code_unique');
            $table->unique(['shop_id', 'code']);
        });

        Schema::table('product_media', function (Blueprint $table) {
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('byte_size')->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->string('checksum', 64)->nullable();
            $table->string('scan_status')->default('approved');
            $table->timestamp('purge_after')->nullable()->index();
            $table->softDeletes();
        });

        Schema::create('product_description_assets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('shop_id')->constrained('shops')->restrictOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('disk');
            $table->text('path');
            $table->string('mime_type');
            $table->unsignedBigInteger('byte_size');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->string('checksum', 64);
            $table->string('scan_status')->default('approved');
            $table->timestamp('referenced_at')->nullable();
            $table->timestamp('purge_after')->nullable()->index();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['product_id', 'scan_status']);
        });

        Schema::create('product_uploads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->foreignUuid('seller_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('upload_token');
            $table->string('purpose');
            $table->string('disk');
            $table->text('path');
            $table->string('mime_type');
            $table->unsignedBigInteger('byte_size');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->string('checksum', 64);
            $table->string('scan_status')->default('approved');
            $table->string('alt_text', 300)->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->index(['shop_id', 'upload_token']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_uploads');
        Schema::dropIfExists('product_description_assets');

        Schema::table('product_media', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['mime_type', 'byte_size', 'width', 'height', 'checksum', 'scan_status', 'purge_after']);
        });
        Schema::table('inventory_skus', function (Blueprint $table) {
            $table->dropUnique(['shop_id', 'code']);
            $table->unique('code');
            $table->dropConstrainedForeignId('shop_id');
        });
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropUnique(['shop_id', 'sku']);
            $table->unique('sku');
            $table->dropConstrainedForeignId('shop_id');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['shop_id', 'base_sku']);
            $table->dropSoftDeletes();
            $table->dropColumn(['base_sku', 'currency', 'purge_after']);
        });
    }
};
