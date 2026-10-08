<?php

namespace Tests\Feature\Vouchers;

use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class VoucherBackfillTest extends TestCase
{
    use RefreshDatabase;

    public function test_additive_migration_imports_legacy_baselines_without_rewriting_definitions(): void
    {
        $migration = require database_path('migrations/2026_10_08_000001_add_voucher_authoring.php');
        $migration->down();
        $voucher = Voucher::create([
            'code' => 'legacy-code', 'issuer_type' => 'app', 'benefit_type' => 'shipping', 'value_type' => 'percent',
            'value' => '25.50', 'minimum_spend' => '10.00', 'maximum_discount' => '500.00',
            'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(), 'global_limit' => 100,
            'per_customer_limit' => 4, 'redeemed_count' => 12, 'terms_summary' => 'Original terms',
            'eligibility_rules' => ['category_ids' => ['preserved-legacy-category']],
            'stacking_policy' => ['allow_with' => ['shop:discount']], 'version' => 7, 'is_active' => false,
        ]);
        $before = (array) DB::table('vouchers')->where('id', $voucher->id)->first();
        $migration->up();
        $after = (array) DB::table('vouchers')->where('id', $voucher->id)->first();
        foreach ($before as $field => $value) {
            $this->assertSame($value, $after[$field], $field);
        }
        $baseline = $voucher->fresh()->versions()->sole();
        $this->assertSame(7, $baseline->number);
        $this->assertSame('published', $baseline->state->value);
        $this->assertSame(['category_ids' => ['preserved-legacy-category']], $baseline->terms['eligibility_rules']);
        $this->assertSame('Original terms', $baseline->terms['terms_summary']);
        $this->assertDatabaseHas('voucher_actions', ['voucher_id' => $voucher->id, 'action' => 'baseline_import']);
    }
}
