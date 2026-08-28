<?php

use App\Enums\ProductStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('shop_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('short_description')->nullable();
            $table->string('thumbnail_disk')->default('public');
            $table->text('thumbnail_path')->nullable();
            $table->decimal('price', 12, 2);
            $table->decimal('original_price', 12, 2)->nullable();
            $table->unsignedBigInteger('stock_quantity')->default(0);
            $table->decimal('average_rating', 3, 2)->nullable();
            $table->unsignedBigInteger('review_count')->default(0);
            $table->unsignedBigInteger('sold_count')->default(0);
            $table->json('badges')->nullable();
            $table->boolean('is_promoted')->default(false);
            $table->string('status')->default(ProductStatus::Draft->value);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'stock_quantity', 'published_at']);
            $table->index(['category_id', 'status']);
            $table->index(['shop_id', 'status']);
            $table->index(['sold_count', 'average_rating']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
