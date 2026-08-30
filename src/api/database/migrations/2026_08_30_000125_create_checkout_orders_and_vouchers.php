<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->string('issuer_type');
            $table->foreignUuid('shop_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('benefit_type');
            $table->string('value_type');
            $table->decimal('value', 12, 2);
            $table->decimal('maximum_discount', 12, 2)->nullable();
            $table->decimal('minimum_spend', 12, 2)->default(0);
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->unsignedBigInteger('global_limit')->nullable();
            $table->unsignedBigInteger('per_customer_limit')->default(1);
            $table->unsignedBigInteger('redeemed_count')->default(0);
            $table->string('payment_method')->nullable();
            $table->json('eligibility_rules')->nullable();
            $table->json('stacking_policy')->nullable();
            $table->text('terms_summary');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
            $table->index(['issuer_type', 'shop_id', 'benefit_type']);
        });

        Schema::create('checkout_quotes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('users')->cascadeOnDelete();
            $table->json('input_payload');
            $table->string('request_hash', 64);
            $table->string('state_hash', 64);
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['customer_id', 'expires_at']);
        });

        Schema::create('checkout_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('checkout_quote_id')->unique()->constrained('checkout_quotes')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->string('currency', 3);
            $table->timestamp('placed_at');
            $table->timestamps();

            $table->unique(['customer_id', 'idempotency_key']);
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('checkout_batch_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('shop_id')->constrained()->restrictOnDelete();
            $table->string('reference')->unique();
            $table->string('status')->default(OrderStatus::Placed->value);
            $table->string('payment_method')->default(PaymentMethod::CashOnDelivery->value);
            $table->string('payment_status')->default(PaymentStatus::Pending->value);
            $table->string('currency', 3);
            $table->decimal('merchandise_subtotal', 12, 2);
            $table->decimal('shipping_fee', 12, 2);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('shipping_discount_total', 12, 2)->default(0);
            $table->decimal('payable_total', 12, 2);
            $table->timestamp('placed_at');
            $table->timestamps();

            $table->unique(['checkout_batch_id', 'shop_id']);
            $table->index(['customer_id', 'placed_at']);
            $table->index(['shop_id', 'status', 'placed_at']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('product_name');
            $table->text('variant_name')->nullable();
            $table->string('sku')->nullable();
            $table->json('selected_options')->nullable();
            $table->decimal('unit_price', 12, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('line_subtotal', 12, 2);
            $table->string('currency', 3);
            $table->timestamps();

            $table->index(['order_id', 'created_at']);
        });

        Schema::create('order_addresses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('source_address_id')->nullable()->constrained('addresses')->nullOnDelete();
            $table->string('recipient_name');
            $table->string('contact_number', 32);
            $table->string('address_line_1');
            $table->string('address_line_2')->nullable();
            $table->string('barangay');
            $table->string('city_municipality');
            $table->string('province');
            $table->string('region');
            $table->string('postal_code', 10);
            $table->string('country');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();
        });

        Schema::create('order_status_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->string('source');
            $table->json('public_metadata')->nullable();
            $table->timestamp('occurred_at');

            $table->index(['order_id', 'occurred_at']);
        });

        Schema::create('order_vouchers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('voucher_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code');
            $table->string('issuer_type');
            $table->string('benefit_type');
            $table->decimal('qualifying_basis', 12, 2);
            $table->decimal('discount_amount', 12, 2);
            $table->string('currency', 3);
            $table->unsignedInteger('rule_version');
            $table->text('terms_summary');
            $table->timestamp('redeemed_at');
            $table->timestamps();

            $table->unique(['order_id', 'voucher_id']);
        });

        Schema::create('voucher_redemptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('voucher_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('checkout_batch_id')->constrained()->restrictOnDelete();
            $table->decimal('discount_amount', 12, 2);
            $table->string('currency', 3);
            $table->timestamp('redeemed_at');
            $table->timestamps();

            $table->unique(['voucher_id', 'order_id']);
            $table->index(['voucher_id', 'customer_id', 'redeemed_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE vouchers ADD CONSTRAINT vouchers_issuer_shop_check CHECK ((issuer_type = 'app' AND shop_id IS NULL) OR (issuer_type = 'shop' AND shop_id IS NOT NULL))");
            DB::statement('ALTER TABLE vouchers ADD CONSTRAINT vouchers_dates_check CHECK (ends_at > starts_at)');
            DB::statement('ALTER TABLE vouchers ADD CONSTRAINT vouchers_amounts_check CHECK (value >= 0 AND minimum_spend >= 0 AND (maximum_discount IS NULL OR maximum_discount >= 0) AND redeemed_count >= 0)');
            DB::statement("ALTER TABLE vouchers ADD CONSTRAINT vouchers_terms_check CHECK (per_customer_limit > 0 AND (value_type <> 'percent' OR value <= 100))");
            DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_totals_check CHECK (merchandise_subtotal >= 0 AND shipping_fee >= 0 AND discount_total >= 0 AND shipping_discount_total >= 0 AND payable_total >= 0)');
            DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_values_check CHECK (quantity > 0 AND unit_price >= 0 AND line_subtotal >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_redemptions');
        Schema::dropIfExists('order_vouchers');
        Schema::dropIfExists('order_status_events');
        Schema::dropIfExists('order_addresses');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('checkout_batches');
        Schema::dropIfExists('checkout_quotes');
        Schema::dropIfExists('vouchers');
    }
};
