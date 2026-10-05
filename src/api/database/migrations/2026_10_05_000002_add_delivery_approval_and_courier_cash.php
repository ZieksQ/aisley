<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logistics_organizations', function (Blueprint $table): void {
            $table->string('delivery_approval_mode')->default('manual');
        });
        Schema::table('completion_intents', function (Blueprint $table): void {
            $table->string('approval_mode')->default('manual');
            $table->uuid('review_organization_id')->nullable()->index();
            $table->uuid('review_hub_id')->nullable();
            $table->string('automatic_review_error')->nullable();
            $table->string('review_method')->nullable();
        });
        Schema::table('shipment_evidence', function (Blueprint $table): void {
            $table->string('review_method')->nullable();
        });
        Schema::table('sandbox_gateway_accounts', function (Blueprint $table): void {
            $table->string('display_last_four', 4)->nullable();
        });
        Schema::create('courier_cash_obligations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('delivery_task_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->string('courier_name');
            $table->string('order_reference');
            $table->string('currency', 3);
            $table->unsignedBigInteger('amount_cents');
            $table->timestamp('delivered_at');
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
            $table->index(['logistics_organization_id', 'received_at']);
        });
        Schema::create('courier_cash_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('received_by')->constrained('users')->restrictOnDelete();
            $table->string('courier_name');
            $table->string('currency', 3);
            $table->unsignedBigInteger('total_cents');
            $table->uuid('idempotency_key');
            $table->string('request_hash');
            $table->timestamp('received_at');
            $table->timestamps();
            $table->unique(['logistics_organization_id', 'idempotency_key'], 'cash_receipt_retry_unique');
        });
        Schema::create('courier_cash_receipt_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('courier_cash_receipt_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_cash_obligation_id')->unique()->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount_cents');
        });
        Schema::create('courier_cash_credits', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('courier_cash_receipt_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('sandbox_gateway_account_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->string('currency', 3);
            $table->timestamp('credited_at')->nullable();
            $table->timestamps();
        });
        // Preserve previously funded test accounts; provision only missing Logistics accounts.
        DB::table('logistics_organizations')->orderBy('id')->each(function ($organization): void {
            DB::table('sandbox_gateway_accounts')->insertOrIgnore([
                'id' => (string) Str::uuid(), 'reference' => 'logistics-'.$organization->id,
                'currency' => 'PHP', 'balance_cents' => 0, 'scenario' => 'success', 'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        });
        DB::table('sandbox_gateway_accounts')->whereNull('display_last_four')->orderBy('id')->each(function ($account): void {
            DB::table('sandbox_gateway_accounts')->where('id', $account->id)->update(['display_last_four' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT)]);
        });
    }

    public function down(): void
    {
        foreach (['courier_cash_credits', 'courier_cash_receipt_items', 'courier_cash_receipts', 'courier_cash_obligations'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('sandbox_gateway_accounts', fn (Blueprint $table) => $table->dropColumn('display_last_four'));
        Schema::table('shipment_evidence', fn (Blueprint $table) => $table->dropColumn('review_method'));
        Schema::table('completion_intents', fn (Blueprint $table) => $table->dropColumn(['approval_mode', 'review_organization_id', 'review_hub_id', 'automatic_review_error', 'review_method']));
        Schema::table('logistics_organizations', fn (Blueprint $table) => $table->dropColumn('delivery_approval_mode'));
    }
};
