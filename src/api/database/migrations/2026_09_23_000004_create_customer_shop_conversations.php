<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('seller_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('shop_id')->constrained('shops')->restrictOnDelete();
            $table->unsignedBigInteger('last_sequence')->default(0);
            $table->uuid('last_message_id')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
            $table->unique(['customer_user_id', 'shop_id']);
            $table->index(['seller_user_id', 'last_message_at']);
            $table->index(['customer_user_id', 'last_message_at']);
        });

        Schema::create('conversation_participants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('last_read_sequence')->default(0);
            $table->timestamps();
            $table->unique(['conversation_id', 'user_id']);
        });

        Schema::create('messages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignUuid('sender_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('sequence');
            $table->uuid('idempotency_key');
            $table->string('payload_hash', 64);
            $table->text('body');
            $table->foreignUuid('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignUuid('order_id')->nullable()->constrained('orders')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['conversation_id', 'sequence']);
            $table->unique(['sender_user_id', 'idempotency_key']);
            $table->index(['conversation_id', 'sequence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
    }
};
