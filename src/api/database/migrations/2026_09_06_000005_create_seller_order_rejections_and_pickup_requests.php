<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_order_rejections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('seller_id')->constrained('users')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->foreignUuid('status_event_id')->unique()->constrained('order_status_events')->restrictOnDelete();
            $table->text('reason')->nullable();
            $table->timestamps();
            $table->unique(['seller_id', 'idempotency_key']);
        });

        Schema::create('seller_pickup_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('shop_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('seller_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('pending_logistics');
            $table->date('pickup_date')->nullable();
            $table->uuid('idempotency_key');
            $table->timestamps();
            $table->unique(['seller_id', 'idempotency_key']);
            $table->index(['shop_id', 'status', 'created_at']);
        });

        Schema::create('seller_pickup_request_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('seller_pickup_request_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('status_event_id')->unique()->constrained('order_status_events')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_pickup_request_orders');
        Schema::dropIfExists('seller_pickup_requests');
        Schema::dropIfExists('seller_order_rejections');
    }
};
