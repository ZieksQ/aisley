<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_qas', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->text('question_text');
            $table->string('question_idempotency_key', 64);
            $table->char('question_request_hash', 64);
            $table->text('answer_text')->nullable();
            $table->foreignUuid('answered_by_seller_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('answer_idempotency_key', 64)->nullable();
            $table->char('answer_request_hash', 64)->nullable();
            $table->timestamp('asked_at');
            $table->timestamp('answered_at')->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'question_idempotency_key'], 'product_qas_customer_idempotency_unique');
            $table->unique(['answered_by_seller_id', 'answer_idempotency_key'], 'product_qas_seller_idempotency_unique');
            $table->index(['product_id', 'asked_at', 'id'], 'product_qas_product_asked_idx');
            $table->index(['customer_id', 'asked_at'], 'product_qas_customer_asked_idx');
            $table->index(['answered_by_seller_id', 'answered_at'], 'product_qas_seller_answered_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_qas');
    }
};
