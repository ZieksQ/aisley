<?php

namespace Tests\Feature\Finance;

use App\Models\Order;
use App\Services\Finance\OrderFundingAuditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FinanceAutomationFixtures;
use Tests\TestCase;

class OrderFundingAuditTest extends TestCase
{
    use FinanceAutomationFixtures, RefreshDatabase;

    public function test_json_inventory_classifies_history_and_keeps_currency_shortfalls_and_surpluses_separate_without_writes(): void
    {
        $organization = $this->logistics('Funding audit');
        $clean = $this->order($organization);
        $outstanding = $this->order($organization);
        $outstanding->update(['status' => 'out_for_delivery']);
        $outstanding->pricingSnapshot()->update(['cod_total_cents' => 59000]);
        $terminal = $this->order($organization);
        $terminal->update(['status' => 'cancelled']);
        $terminal->pricingSnapshot()->update(['cod_total_cents' => 59999]);
        $recognized = $this->order($organization);
        $this->fund($recognized, $organization);
        $recognized->pricingSnapshot()->update(['cod_total_cents' => 58000]);
        $surplus = $this->order($organization);
        $surplus->pricingSnapshot()->update(['cod_total_cents' => 60010, 'currency' => 'USD']);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->assertSame(1, Artisan::call('finance:audit-order-funding', ['--json' => true]));
        $output = Artisan::output();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
        foreach ($queries as $query) {
            $this->assertMatchesRegularExpression('/^select\s/i', $query['query']);
        }
        $report = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
        $rows = collect($report['discrepancies'])->keyBy('order_id');
        $this->assertFalse($rows->has($clean->id));
        $this->assertSame([
            'order_id' => $outstanding->id, 'snapshot_id' => $outstanding->pricingSnapshot->id,
            'order_status' => 'out_for_delivery', 'currency' => 'PHP', 'funding_cents' => 59000,
            'obligations_cents' => 60000, 'difference_cents' => 1000,
            'recognized' => false, 'classification' => 'outstanding',
        ], $rows[$outstanding->id]);
        $this->assertSame('terminal', $rows[$terminal->id]['classification']);
        $this->assertSame('already_recognized', $rows[$recognized->id]['classification']);
        $this->assertTrue($rows[$recognized->id]['recognized']);
        $this->assertSame(-10, $rows[$surplus->id]['difference_cents']);
        $this->assertSame([
            'scanned_snapshots' => 5, 'discrepancies' => 4,
            'totals_by_currency' => [
                'PHP' => ['count' => 3, 'outstanding' => 1, 'terminal' => 1, 'already_recognized' => 1,
                    'funding_cents' => 176999, 'obligations_cents' => 180000, 'shortfall_cents' => 3001, 'surplus_cents' => 0],
                'USD' => ['count' => 1, 'outstanding' => 0, 'terminal' => 1, 'already_recognized' => 0,
                    'funding_cents' => 60010, 'obligations_cents' => 60000, 'shortfall_cents' => 0, 'surplus_cents' => 10],
            ],
        ], $report['summary']);
        foreach (['Private Buyer', 'Private Barangay', 'Makati', 'destination_snapshot', 'customer_id', 'storage_path'] as $private) {
            $this->assertStringNotContainsString($private, $output);
        }
    }

    public function test_order_filter_empty_results_and_clean_exit(): void
    {
        $organization = $this->logistics('Filtered audit');
        $clean = $this->order($organization);
        $shortfall = $this->order($organization);
        $shortfall->pricingSnapshot()->update(['cod_total_cents' => 59000]);
        $this->assertSame(0, Artisan::call('finance:audit-order-funding', ['--order' => $clean->id, '--json' => true]));
        $report = json_decode(Artisan::output(), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame([], $report['discrepancies']);
        $this->assertSame(1, $report['summary']['scanned_snapshots']);
        $this->assertSame(1, Artisan::call('finance:audit-order-funding', ['--order' => $shortfall->id, '--json' => true]));
        $report = json_decode(Artisan::output(), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame([$shortfall->id], array_column($report['discrepancies'], 'order_id'));
        $this->assertSame(0, Artisan::call('finance:audit-order-funding', ['--order' => (string) Str::uuid(), '--json' => true]));
        $report = json_decode(Artisan::output(), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame(0, $report['summary']['scanned_snapshots']);
        $this->assertSame([], $report['discrepancies']);
    }

    public function test_invalid_order_filter_is_rejected_before_database_access(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->assertSame(2, Artisan::call('finance:audit-order-funding', ['--order' => 'not-a-uuid']));
        $this->assertStringContainsString('--order must be an Order UUID.', Artisan::output());
        $this->assertSame([], DB::getQueryLog());
        DB::disableQueryLog();
    }

    public function test_human_output_includes_ids_amounts_classification_and_currency_totals(): void
    {
        $order = $this->order($this->logistics('Text audit'));
        $order->update(['status' => 'placed']);
        $order->pricingSnapshot()->update(['cod_total_cents' => 59000]);
        $this->assertSame(1, Artisan::call('finance:audit-order-funding'));
        $output = Artisan::output();
        foreach ([$order->id, $order->pricingSnapshot->id, 'placed', 'PHP', 'funding=59000', 'obligations=60000', 'difference=1000', 'recognized=no', 'outstanding', '"shortfall_cents":1000'] as $expected) {
            $this->assertStringContainsString($expected, $output);
        }
    }

    public function test_inventory_streams_every_snapshot_across_chunk_boundaries_once(): void
    {
        $seed = $this->order($this->logistics('Chunk audit'));
        $seed->update(['status' => 'placed']);
        $seed->pricingSnapshot()->update(['cod_total_cents' => 59999]);
        for ($i = 0; $i < 201; $i++) {
            $quote = $seed->batch->quote->replicate();
            $quote->save();
            $batch = $seed->batch->replicate();
            $batch->checkout_quote_id = $quote->id;
            $batch->idempotency_key = (string) Str::uuid();
            $batch->save();
            $order = new Order($seed->getAttributes());
            $order->id = (string) Str::uuid();
            $order->checkout_batch_id = $batch->id;
            $order->reference = 'CHUNK-'.Str::uuid();
            $order->save();
            $snapshot = $seed->pricingSnapshot->replicate();
            $snapshot->order_id = $order->id;
            $snapshot->save();
        }
        $ids = [];
        $summary = app(OrderFundingAuditService::class)->scan(function (array $row) use (&$ids): void {
            $ids[] = $row['snapshot_id'];
        });
        $this->assertSame(202, $summary['scanned_snapshots']);
        $this->assertSame(202, $summary['discrepancies']);
        $this->assertCount(202, array_unique($ids));
        $this->assertSame(202, $summary['totals_by_currency']['PHP']['outstanding']);
        $this->assertSame(202, $summary['totals_by_currency']['PHP']['shortfall_cents']);
    }
}
