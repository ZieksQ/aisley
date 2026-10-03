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
        Schema::table('order_pricing_snapshots', function (Blueprint $table): void {
            $table->string('shipping_pricing_model')->default('platform_base_v1');
        });
        Schema::create('logistics_service_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_rate_card_id')->constrained()->cascadeOnDelete();
            $table->string('service_type');
            $table->unsignedBigInteger('base_fee_cents');
            $table->timestamps();
            $table->unique(['logistics_rate_card_id', 'service_type'], 'logistics_service_rate_unique');
        });

        // Preserve existing category coverage, charging its highest legacy base once per leg.
        // Historical rules and placed Order snapshots remain untouched.
        DB::table('logistics_rate_rules')
            ->select('logistics_rate_card_id', 'service_type')
            ->selectRaw('MAX(base_charge_cents) AS base_fee_cents')
            ->groupBy('logistics_rate_card_id', 'service_type')
            ->orderBy('logistics_rate_card_id')
            ->get()->each(function (object $rate): void {
                DB::table('logistics_service_rates')->insert([
                    'id' => (string) Str::uuid(),
                    'logistics_rate_card_id' => $rate->logistics_rate_card_id,
                    'service_type' => $rate->service_type,
                    'base_fee_cents' => $rate->base_fee_cents,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_service_rates');
        Schema::table('order_pricing_snapshots', fn (Blueprint $table) => $table->dropColumn('shipping_pricing_model'));
    }
};
