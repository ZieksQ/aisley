<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reviews', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained('orders')->restrictOnDelete();
            $table->foreignUuid('order_item_id')->constrained('order_items')->restrictOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('product_name_snapshot', 255);
            $table->text('variant_name_snapshot')->nullable();
            $table->unsignedSmallInteger('rating');
            $table->text('body');
            $table->string('status', 32)->default('published');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique('order_item_id', 'product_reviews_order_item_unique');
            $table->index(['product_id', 'status', 'created_at', 'id'], 'product_reviews_public_listing_idx');
            $table->index(['customer_id', 'created_at'], 'product_reviews_customer_created_idx');
            $table->index(['order_id', 'created_at'], 'product_reviews_order_created_idx');
        });

        Schema::create('product_review_images', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('review_id')->constrained('product_reviews')->restrictOnDelete();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->string('disk', 64);
            $table->text('path');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('byte_size');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->char('checksum', 64);
            $table->string('status', 32)->default('approved');
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['review_id', 'position'], 'product_review_images_review_position_unique');
            $table->index(['review_id', 'status'], 'product_review_images_review_status_idx');
        });

        // Product aggregates are authoritative projections of published reviews.
        DB::table('products')->update([
            'average_rating' => null,
            'review_count' => 0,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('product_review_images');
        Schema::dropIfExists('product_reviews');
    }
};
