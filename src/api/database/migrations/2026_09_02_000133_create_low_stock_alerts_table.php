<?php

use App\Enums\Seller\LowStockAlertState;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('low_stock_alerts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('seller_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('shop_id')->constrained('shops')->restrictOnDelete();
            $table->foreignUuid('inventory_sku_id')->constrained('inventory_skus')->restrictOnDelete();
            $table->foreignUuid('trigger_movement_id')->nullable()->constrained('inventory_movements')->restrictOnDelete();
            $table->unsignedBigInteger('trigger_threshold');
            $table->unsignedBigInteger('trigger_available');
            $table->unsignedBigInteger('current_threshold');
            $table->unsignedBigInteger('current_available');
            $table->string('state')->default(LowStockAlertState::Active->value);
            $table->string('active_marker')->nullable()->default('active');
            $table->string('resolution_reason')->nullable();
            $table->timestamp('triggered_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->unique(['inventory_sku_id', 'active_marker'], 'inventory_sku_active_low_stock_alert_unique');
            $table->index(['seller_id', 'state', 'triggered_at']);
            $table->index(['shop_id', 'triggered_at']);
            $table->index(['inventory_sku_id', 'triggered_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('low_stock_alerts');
    }
};
