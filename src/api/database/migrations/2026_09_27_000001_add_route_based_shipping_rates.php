<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_rate_region_surcharges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('shipping_rate_version_id')->constrained()->cascadeOnDelete();
            $table->string('destination_region');
            $table->string('normalized_region');
            $table->unsignedBigInteger('surcharge_cents');
            $table->timestamps();
            $table->unique(['shipping_rate_version_id', 'normalized_region'], 'shipping_rate_region_unique');
        });

        Schema::create('shop_logistics_providers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('shop_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->boolean('is_enabled')->default(true);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('configured_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['shop_id', 'logistics_organization_id'], 'shop_logistics_provider_unique');
        });

        Schema::create('logistics_rate_cards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('status')->default('draft');
            $table->string('currency', 3)->default('PHP');
            $table->timestamp('effective_at');
            $table->timestamp('published_at')->nullable();
            $table->foreignUuid('published_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
            $table->unique(['logistics_organization_id', 'version_number'], 'logistics_rate_card_version_unique');
            $table->index(['logistics_organization_id', 'status', 'effective_at'], 'logistics_rate_card_active');
        });

        Schema::create('logistics_rate_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_rate_card_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained()->restrictOnDelete();
            $table->string('service_type');
            $table->unsignedBigInteger('base_charge_cents');
            $table->unsignedInteger('included_weight_grams');
            $table->unsignedInteger('additional_weight_grams');
            $table->unsignedBigInteger('additional_fee_cents');
            $table->unsignedInteger('max_weight_grams');
            $table->unsignedInteger('max_length_mm');
            $table->unsignedInteger('max_width_mm');
            $table->unsignedInteger('max_height_mm');
            $table->timestamps();
            $table->unique(['logistics_rate_card_id', 'category_id', 'service_type'], 'logistics_rate_rule_unique');
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignUuid('selected_logistics_organization_id')->nullable()->after('shop_id')->constrained('logistics_organizations')->restrictOnDelete();
        });

        Schema::table('order_pricing_snapshots', function (Blueprint $table): void {
            $table->foreignUuid('selected_logistics_organization_id')->nullable()->after('shipping_rate_version_id')->constrained('logistics_organizations')->restrictOnDelete();
            $table->string('shipping_route_status')->default('unplanned')->after('selected_logistics_organization_id');
            $table->json('shipping_route_snapshot')->nullable()->after('shipping_route_status');
            $table->json('logistics_charge_inputs')->nullable()->after('line_inputs');
        });

        Schema::table('logistics_service_allocations', function (Blueprint $table): void {
            $table->unsignedBigInteger('quoted_charge_cents')->nullable()->after('distance_meters');
        });

        Schema::create('logistics_route_reconciliations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('financial_hold_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('shipping_pool_cents');
            $table->unsignedBigInteger('platform_subsidy_cents')->default(0);
            $table->unsignedBigInteger('total_allocation_cents');
            $table->json('allocations');
            $table->text('notes');
            $table->foreignUuid('reconciled_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('reconciled_at');
            $table->timestamps();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE logistics_rate_rules ADD CONSTRAINT logistics_rate_rule_values_valid CHECK (included_weight_grams > 0 AND additional_weight_grams > 0 AND max_weight_grams > 0 AND max_length_mm > 0 AND max_width_mm > 0 AND max_height_mm > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_route_reconciliations');
        Schema::table('logistics_service_allocations', fn (Blueprint $table) => $table->dropColumn('quoted_charge_cents'));
        Schema::table('order_pricing_snapshots', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('selected_logistics_organization_id');
            $table->dropColumn(['shipping_route_status', 'shipping_route_snapshot', 'logistics_charge_inputs']);
        });
        Schema::table('orders', fn (Blueprint $table) => $table->dropConstrainedForeignId('selected_logistics_organization_id'));
        Schema::dropIfExists('logistics_rate_rules');
        Schema::dropIfExists('logistics_rate_cards');
        Schema::dropIfExists('shop_logistics_providers');
        Schema::dropIfExists('shipping_rate_region_surcharges');
    }
};
