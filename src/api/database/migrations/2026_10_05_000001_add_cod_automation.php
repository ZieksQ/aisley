<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_automation_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('scope_key')->unique();
            $table->unsignedInteger('cod_deadline_hours')->default(72);
            $table->unsignedInteger('seller_delay_hours')->default(336);
            $table->unsignedInteger('logistics_delay_hours')->default(24);
            $table->string('collection_time', 5)->default('09:00');
            $table->string('seller_payout_time', 5)->default('09:00');
            $table->string('logistics_payout_time', 5)->default('09:00');
            $table->boolean('collection_enabled')->default(true);
            $table->boolean('seller_payout_enabled')->default(true);
            $table->boolean('logistics_payout_enabled')->default(true);
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
        Schema::create('cod_invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('reference')->unique();
            $table->string('order_reference');
            $table->string('collector_name')->nullable();
            $table->string('status')->default('outstanding');
            $table->string('currency', 3);
            $table->unsignedBigInteger('total_cents');
            $table->timestamp('delivered_at');
            $table->timestamp('due_at');
            $table->timestamp('seller_eligible_at');
            $table->timestamp('logistics_eligible_at');
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('overdue_notified_at')->nullable();
            $table->string('review_reason')->nullable();
            $table->timestamps();
            $table->index(['logistics_organization_id', 'status', 'due_at']);
        });
        Schema::table('cod_remittance_batches', function (Blueprint $table): void {
            $table->timestamp('rejected_at')->nullable();
            $table->foreignUuid('rejected_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('rejection_reason', 2000)->nullable();
            $table->boolean('is_gateway')->default(false);
        });
        Schema::table('finance_payout_items', function (Blueprint $table): void {
            $table->dropUnique('payout_item_obligation_unique');
            $table->timestamp('released_at')->nullable();
            $table->unique(['finance_payout_id', 'order_id'], 'payout_item_attempt_unique');
            $table->index(['order_id', 'beneficiary_type', 'beneficiary_id', 'released_at'], 'payout_active_obligation');
        });
        Schema::create('finance_payment_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('direction');
            $table->string('status')->default('reserved');
            $table->string('idempotency_key')->unique();
            $table->string('request_hash');
            $table->string('provider_reference')->nullable()->unique();
            $table->string('account_reference');
            $table->string('currency', 3);
            $table->unsignedBigInteger('amount_cents');
            $table->foreignUuid('cod_remittance_batch_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('finance_payout_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('initiated_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('failure_code')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'updated_at']);
        });
        Schema::create('finance_automation_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('run_key')->unique();
            $table->string('kind');
            $table->string('scope_key');
            $table->timestamp('cutoff_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
        Schema::create('sandbox_gateway_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('reference')->unique();
            $table->string('currency', 3)->default('PHP');
            $table->unsignedBigInteger('balance_cents')->default(100000000);
            $table->string('scenario')->default('success');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
        Schema::create('sandbox_gateway_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('idempotency_key')->unique();
            $table->string('request_hash');
            $table->string('direction');
            $table->string('status')->default('pending');
            $table->string('account_reference');
            $table->string('currency', 3);
            $table->unsignedBigInteger('amount_cents');
            $table->json('metadata');
            $table->string('scenario');
            $table->string('failure_code')->nullable();
            $table->timestamps();
        });
        Schema::create('finance_gateway_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('sandbox_gateway_transaction_id')->constrained()->restrictOnDelete();
            $table->json('payload');
            $table->unsignedInteger('delivery_attempts')->default(0);
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });
        Schema::create('finance_webhook_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('event_id')->unique();
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['finance_webhook_receipts', 'finance_gateway_events', 'sandbox_gateway_transactions', 'sandbox_gateway_accounts', 'finance_automation_runs', 'finance_payment_attempts'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('cod_remittance_batches', function (Blueprint $table): void {
            $table->dropForeign(['rejected_by']);
            $table->dropColumn(['rejected_at', 'rejected_by', 'rejection_reason', 'is_gateway']);
        });
        Schema::table('finance_payout_items', function (Blueprint $table): void {
            $table->dropUnique('payout_item_attempt_unique');
            $table->dropIndex('payout_active_obligation');
            $table->dropColumn('released_at');
            $table->unique(['order_id', 'beneficiary_type', 'beneficiary_id'], 'payout_item_obligation_unique');
        });
        Schema::dropIfExists('cod_invoices');
        Schema::dropIfExists('finance_automation_settings');
    }
};
