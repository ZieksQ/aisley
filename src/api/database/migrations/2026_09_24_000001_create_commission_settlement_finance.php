<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_rate_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedInteger('version_number')->unique();
            $table->string('status')->default('draft');
            $table->string('currency', 3)->default('PHP');
            foreach (['origin_region', 'origin_province', 'origin_city_municipality', 'origin_barangay', 'destination_region', 'destination_province', 'destination_city_municipality', 'destination_barangay'] as $column) {
                $table->string($column)->nullable();
            }
            $table->unsignedBigInteger('base_fee_cents');
            $table->unsignedInteger('included_weight_grams');
            $table->unsignedInteger('additional_weight_grams');
            $table->unsignedBigInteger('additional_fee_cents');
            $table->unsignedInteger('volumetric_divisor');
            $table->unsignedInteger('max_weight_grams');
            $table->unsignedInteger('max_length_mm');
            $table->unsignedInteger('max_width_mm');
            $table->unsignedInteger('max_height_mm');
            $table->unsignedBigInteger('destination_surcharge_cents')->default(0);
            $table->timestamp('effective_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->foreignUuid('published_by_admin_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
            $table->index(['status', 'effective_at']);
        });

        Schema::create('logistics_shipping_rate_acceptances', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('shipping_rate_version_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('accepted_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('accepted_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->unique(['shipping_rate_version_id', 'logistics_organization_id'], 'rate_acceptance_unique');
        });

        Schema::create('commission_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('beneficiary_type');
            $table->unsignedInteger('rate_basis_points');
            $table->string('status')->default('draft');
            $table->timestamp('effective_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->foreignUuid('published_by_admin_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
            $table->index(['beneficiary_type', 'status', 'effective_at']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedInteger('shipping_weight_grams')->nullable();
            $table->unsignedInteger('shipping_length_mm')->nullable();
            $table->unsignedInteger('shipping_width_mm')->nullable();
            $table->unsignedInteger('shipping_height_mm')->nullable();
            $table->unsignedBigInteger('unit_cost_cents')->nullable();
            $table->string('cost_currency', 3)->nullable();
        });
        Schema::table('product_variants', function (Blueprint $table): void {
            $table->unsignedInteger('shipping_weight_grams')->nullable();
            $table->unsignedInteger('shipping_length_mm')->nullable();
            $table->unsignedInteger('shipping_width_mm')->nullable();
            $table->unsignedInteger('shipping_height_mm')->nullable();
            $table->unsignedBigInteger('unit_cost_cents')->nullable();
            $table->string('cost_currency', 3)->nullable();
        });
        Schema::table('order_items', function (Blueprint $table): void {
            $table->unsignedBigInteger('unit_cost_cents')->nullable();
            $table->string('cost_currency', 3)->nullable();
        });

        Schema::create('order_pricing_snapshots', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('shipping_rate_version_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('seller_commission_policy_id')->constrained('commission_policies')->restrictOnDelete();
            $table->foreignUuid('logistics_commission_policy_id')->constrained('commission_policies')->restrictOnDelete();
            $table->string('currency', 3);
            $table->unsignedInteger('billable_weight_grams');
            $table->unsignedBigInteger('base_fee_cents');
            $table->unsignedBigInteger('additional_weight_fee_cents');
            $table->unsignedBigInteger('destination_surcharge_cents');
            $table->unsignedBigInteger('quoted_shipping_fee_cents');
            $table->unsignedBigInteger('shipping_subsidy_cents')->default(0);
            $table->unsignedBigInteger('seller_commission_base_cents');
            $table->unsignedBigInteger('seller_commission_cents');
            $table->unsignedBigInteger('seller_proceeds_cents');
            $table->unsignedBigInteger('logistics_commission_cents');
            $table->unsignedBigInteger('logistics_pool_cents');
            $table->unsignedBigInteger('cod_total_cents');
            $table->json('origin_snapshot');
            $table->json('destination_snapshot');
            $table->json('line_inputs');
            $table->json('voucher_funding');
            $table->json('eligible_logistics_organization_ids');
            $table->timestamp('snapshotted_at');
            $table->timestamps();
        });

        Schema::create('finance_journal_entries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('idempotency_key')->unique();
            $table->string('event_type');
            $table->foreignUuid('order_id')->nullable()->constrained()->restrictOnDelete();
            $table->uuid('reversal_of_id')->nullable();
            $table->string('currency', 3);
            $table->text('memo')->nullable();
            $table->timestamp('effective_at');
            $table->timestamps();
            $table->index(['order_id', 'effective_at']);
        });

        // PostgreSQL creates this table's primary-key constraint after the CREATE
        // TABLE statement. Add the self-reference only once that constraint exists.
        Schema::table('finance_journal_entries', function (Blueprint $table): void {
            $table->foreign('reversal_of_id')
                ->references('id')
                ->on('finance_journal_entries')
                ->restrictOnDelete();
        });

        Schema::create('finance_ledger_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('journal_entry_id')->constrained('finance_journal_entries')->restrictOnDelete();
            $table->string('account_code');
            $table->string('owner_type')->nullable();
            $table->uuid('owner_id')->nullable();
            $table->unsignedBigInteger('debit_cents')->default(0);
            $table->unsignedBigInteger('credit_cents')->default(0);
            $table->timestamps();
            $table->index(['owner_type', 'owner_id', 'account_code'], 'finance_lines_owner_account');
        });

        Schema::create('financial_holds', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->string('reason_code');
            $table->text('notes')->nullable();
            $table->foreignUuid('placed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('placed_at');
            $table->foreignUuid('released_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->index(['order_id', 'released_at']);
        });

        Schema::create('cod_remittance_batches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->string('reference');
            $table->string('status')->default('submitted');
            $table->string('currency', 3);
            $table->unsignedBigInteger('total_cents');
            $table->timestamp('submitted_at');
            $table->foreignUuid('cleared_by_admin_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('cleared_at')->nullable();
            $table->timestamps();
            $table->unique(['logistics_organization_id', 'reference']);
        });

        Schema::create('cod_remittance_allocations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('cod_remittance_batch_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->timestamps();
            $table->unique(['cod_remittance_batch_id', 'order_id'], 'remittance_batch_order_unique');
            $table->index(['order_id', 'created_at']);
        });

        Schema::create('logistics_service_allocations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->string('service_type');
            $table->foreignUuid('shipment_route_hop_id')->nullable()->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('distance_meters')->nullable();
            $table->unsignedBigInteger('amount_cents');
            $table->string('status')->default('committed');
            $table->timestamp('committed_at')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'logistics_organization_id', 'service_type', 'shipment_route_hop_id'], 'service_allocation_unique');
        });

        Schema::create('finance_expenses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('owner_type');
            $table->uuid('owner_id')->nullable();
            $table->string('category');
            $table->string('description');
            $table->string('currency', 3);
            $table->unsignedBigInteger('amount_cents');
            $table->boolean('is_recurring_monthly')->default(false);
            $table->date('incurred_on');
            $table->foreignUuid('linehaul_trip_id')->nullable()->constrained()->restrictOnDelete();
            $table->uuid('correction_of_id')->nullable();
            $table->foreignUuid('recorded_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['owner_type', 'owner_id', 'incurred_on']);
        });

        Schema::table('finance_expenses', function (Blueprint $table): void {
            $table->foreign('correction_of_id')
                ->references('id')
                ->on('finance_expenses')
                ->restrictOnDelete();
        });

        Schema::create('finance_expense_allocations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('finance_expense_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->timestamps();
            $table->unique(['finance_expense_id', 'order_id'], 'expense_allocation_order_unique');
        });

        Schema::create('finance_period_closures', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('owner_type');
            $table->uuid('owner_id')->nullable();
            $table->date('period_month');
            $table->boolean('costs_complete');
            $table->foreignUuid('closed_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('closed_at');
            $table->timestamps();
            $table->unique(['owner_type', 'owner_id', 'period_month'], 'finance_period_owner_month_unique');
        });

        Schema::create('finance_sandbox_beneficiary_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('beneficiary_type');
            $table->uuid('beneficiary_id');
            $table->string('account_reference');
            $table->string('scenario')->default('success');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['beneficiary_type', 'beneficiary_id'], 'sandbox_beneficiary_unique');
        });

        Schema::create('finance_payouts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('beneficiary_type');
            $table->uuid('beneficiary_id');
            $table->foreignUuid('sandbox_beneficiary_account_id')->constrained('finance_sandbox_beneficiary_accounts')->restrictOnDelete();
            $table->string('currency', 3);
            $table->unsignedBigInteger('amount_cents');
            $table->string('status')->default('reserved');
            $table->string('sandbox_scenario');
            $table->boolean('is_sandbox')->default(true);
            $table->string('idempotency_key')->unique();
            $table->string('provider_reference')->nullable()->unique();
            $table->timestamp('eligible_through');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['beneficiary_type', 'beneficiary_id', 'status']);
        });

        Schema::create('finance_payout_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('finance_payout_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->string('beneficiary_type');
            $table->uuid('beneficiary_id');
            $table->unsignedBigInteger('amount_cents');
            $table->timestamps();
            $table->unique(['order_id', 'beneficiary_type', 'beneficiary_id'], 'payout_item_obligation_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE commission_policies ADD CONSTRAINT commission_rate_valid CHECK (rate_basis_points <= 10000)');
            DB::statement('ALTER TABLE shipping_rate_versions ADD CONSTRAINT shipping_rate_values_valid CHECK (additional_weight_grams > 0 AND volumetric_divisor > 0 AND included_weight_grams > 0 AND max_weight_grams > 0 AND max_length_mm > 0 AND max_width_mm > 0 AND max_height_mm > 0)');
            DB::statement('ALTER TABLE finance_ledger_lines ADD CONSTRAINT finance_line_one_side CHECK ((debit_cents > 0 AND credit_cents = 0) OR (credit_cents > 0 AND debit_cents = 0))');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_payout_items');
        Schema::dropIfExists('finance_payouts');
        Schema::dropIfExists('finance_sandbox_beneficiary_accounts');
        Schema::dropIfExists('finance_period_closures');
        Schema::dropIfExists('finance_expense_allocations');
        Schema::dropIfExists('finance_expenses');
        Schema::dropIfExists('logistics_service_allocations');
        Schema::dropIfExists('cod_remittance_allocations');
        Schema::dropIfExists('cod_remittance_batches');
        Schema::dropIfExists('financial_holds');
        Schema::dropIfExists('finance_ledger_lines');
        Schema::dropIfExists('finance_journal_entries');
        Schema::dropIfExists('order_pricing_snapshots');
        Schema::table('order_items', fn (Blueprint $table) => $table->dropColumn(['unit_cost_cents', 'cost_currency']));
        Schema::table('product_variants', fn (Blueprint $table) => $table->dropColumn(['shipping_weight_grams', 'shipping_length_mm', 'shipping_width_mm', 'shipping_height_mm', 'unit_cost_cents', 'cost_currency']));
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn(['shipping_weight_grams', 'shipping_length_mm', 'shipping_width_mm', 'shipping_height_mm', 'unit_cost_cents', 'cost_currency']));
        Schema::dropIfExists('commission_policies');
        Schema::dropIfExists('logistics_shipping_rate_acceptances');
        Schema::dropIfExists('shipping_rate_versions');
    }
};
