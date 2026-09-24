<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_review_responses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('review_id')->constrained('product_reviews')->restrictOnDelete();
            $table->foreignUuid('seller_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('shop_id')->constrained('shops')->restrictOnDelete();
            $table->string('shop_name_snapshot', 255);
            $table->text('body');
            $table->string('status', 32)->default('published');
            $table->uuid('idempotency_key');
            $table->char('request_hash', 64);
            $table->timestamp('published_at');
            $table->timestamps();

            $table->unique('review_id', 'seller_review_responses_review_unique');
            $table->unique(['seller_id', 'idempotency_key'], 'seller_review_responses_seller_idempotency_unique');
            $table->index(['shop_id', 'published_at'], 'seller_review_responses_shop_published_idx');
            $table->index(['seller_id', 'published_at'], 'seller_review_responses_seller_published_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_review_responses');
    }
};
