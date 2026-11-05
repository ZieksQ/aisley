<?php

namespace Tests\Feature\Finance;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CodRemittanceBatch;
use App\Models\FinanceGatewayEvent;
use App\Models\FinancePayout;
use App\Models\FinancePeriodClosure;
use App\Models\FinanceSandboxBeneficiaryAccount;
use App\Models\FinancialHold;
use App\Models\Permission;
use App\Models\SandboxGatewayTransaction;
use App\Models\User;
use App\Services\Finance\Automation\CodInvoiceService;
use App\Services\Finance\FinanceReportService;
use App\Services\Finance\LedgerService;
use Carbon\CarbonImmutable;
use Database\Seeders\AdminPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\FinanceAutomationFixtures;
use Tests\TestCase;

class FinanceDateRangeTest extends TestCase
{
    use FinanceAutomationFixtures, RefreshDatabase;

    private const RANGE = '?date_from=2026-11-01&date_to=2026-11-01';

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-11-05 12:00:00', 'Asia/Manila'));
    }

    public function test_totals_series_and_csv_use_manila_boundaries_for_every_role(): void
    {
        $organization = $this->logistics('Scoped');
        $order = $this->order($organization);
        $foreign = $this->order($this->logistics('Other'));
        $moments = ['2026-10-31T15:59:59Z', '2026-10-31T16:00:00Z', '2026-11-01T15:59:59Z', '2026-11-01T16:00:00Z'];
        foreach ($moments as $index => $at) {
            $this->postRevenue($order->shop_id, $organization->id, $at, 1000 + $index);
        }
        $this->postRevenue($foreign->shop_id, $foreign->selected_logistics_organization_id, $moments[1], 99999);
        app(LedgerService::class)->post('costs', 'period_cost', 'PHP', [
            ['account_code' => 'operating_expense', 'owner_type' => 'seller', 'owner_id' => $order->shop_id, 'debit_cents' => 100],
            ['account_code' => 'cash', 'owner_type' => 'seller', 'owner_id' => $order->shop_id, 'credit_cents' => 100],
        ], CarbonImmutable::parse($moments[1]));
        foreach ([['seller', $order->shop->seller], ['logistics', $organization->user], ['admin', $this->admin()]] as [$role, $user]) {
            $this->actingAs($user);
            $response = $this->getJson("/api/v1/{$role}/finance/summary".self::RANGE)->assertOk()
                ->assertJsonPath('data.period.dateFrom', '2026-11-01')->assertJsonPath('data.period.dateTo', '2026-11-01')->assertJsonCount(1, 'data.series');
            $expected = $role === 'admin' ? 102002 : 2003;
            $response->assertJsonPath('data.summary.revenueCents', $expected)->assertJsonPath('data.series.0.actualRevenueCents', $expected);
            if ($role === 'seller') {
                $response->assertJsonPath('data.summary.costsCents', 100)->assertJsonPath('data.summary.profitCents', 1903)->assertJsonPath('data.summary.availableBalanceCents', 4006);
            }
            $this->getJson("/api/v1/{$role}/finance/ledger".self::RANGE.'&search=range_revenue')->assertOk()->assertJsonPath('total', $role === 'admin' ? 3 : 2);
            $csv = $this->get("/api/v1/{$role}/finance/ledger.csv".self::RANGE.'&search=range_revenue');
            $csv->assertOk()->assertHeader('Cache-Control', 'no-store, private');
            $content = $csv->streamedContent();
            $this->assertStringContainsString('2026-10-31T16:00:00', $content);
            $this->assertStringNotContainsString('2026-10-31T15:59:59', $content);
            $this->assertStringNotContainsString('2026-11-01T16:00:00', $content);
            if ($role !== 'admin') {
                $this->assertStringNotContainsString('99999', $content);
            }
        }
    }

    public function test_validation_and_permissions_cover_reports_and_histories(): void
    {
        $this->actingAs($this->admin());
        foreach (['summary', 'ledger', 'ledger.csv', 'invoices', 'remittances', 'payout-history', 'holds', 'sandbox'] as $path) {
            foreach (['date_from=&date_to=', 'date_from=2026-11-01', 'date_to=2026-11-01', 'date_from=2026-11-03&date_to=2026-11-01', 'date_from=2026-11-06&date_to=2026-11-06', 'date_from=2026-02-30&date_to=2026-03-01', 'all_time=1&date_from=2026-11-01&date_to=2026-11-01'] as $invalid) {
                $this->getJson('/api/v1/admin/finance/'.$path.'?'.$invalid)->assertUnprocessable();
            }
        }
        $denied = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->actingAs($denied)->getJson('/api/v1/admin/finance/summary'.self::RANGE)->assertForbidden();
        $this->getJson('/api/v1/admin/finance/ledger.csv'.self::RANGE)->assertForbidden();
    }

    public function test_current_balance_forecast_and_empty_periods_are_distinct(): void
    {
        $organization = $this->logistics('Current');
        $order = $this->order($organization);
        $this->postRevenue($order->shop_id, $organization->id, '2026-10-01T12:00:00Z', 1500);
        $this->actingAs($order->shop->seller);
        $all = $this->getJson('/api/v1/seller/finance/summary')->assertOk()->json('data');
        $empty = $this->getJson('/api/v1/seller/finance/summary'.self::RANGE)->assertOk()->assertJsonPath('data.summary.revenueCents', 0)
            ->assertJsonPath('data.summary.availableBalanceCents', 1500)->json('data');
        $this->assertSame($all['forecast'], $empty['forecast']);
        $this->assertSame($all['payoutSchedule'], $empty['payoutSchedule']);
        $this->getJson('/api/v1/seller/finance/ledger'.self::RANGE)->assertJsonPath('total', 0);
        $this->getJson('/api/v1/seller/finance/summary?all_time=1')->assertJsonPath('data.summary.revenueCents', 1500)->assertJsonPath('data.series.0.date', '2026-10-01');
    }

    public function test_histories_filter_before_pagination_and_keep_tenant_scope(): void
    {
        $organization = $this->logistics('History');
        $other = $this->logistics('Foreign history');
        $order = $this->order($organization);
        $oldOrder = $this->order($organization);
        $foreignOrder = $this->order($other);
        $inRange = CarbonImmutable::parse('2026-10-31T16:00:00Z');
        $before = $inRange->subSecond();
        $invoice = app(CodInvoiceService::class)->issue($order, $organization->id, $inRange);
        app(CodInvoiceService::class)->issue($oldOrder, $organization->id, $before);
        app(CodInvoiceService::class)->issue($foreignOrder, $other->id, $inRange);
        foreach ([[$organization, $order, $inRange], [$organization, $oldOrder, $before], [$other, $foreignOrder, $inRange]] as [$owner, $record, $at]) {
            CodRemittanceBatch::create(['logistics_organization_id' => $owner->id, 'reference' => 'range-'.Str::uuid(), 'status' => 'submitted', 'total_cents' => 60000, 'currency' => 'PHP', 'submitted_at' => $at]);
            FinancePayout::create(['sandbox_beneficiary_account_id' => FinanceSandboxBeneficiaryAccount::firstOrCreate(['beneficiary_type' => 'logistics', 'beneficiary_id' => $owner->id], ['account_reference' => 'test-'.$owner->id])->id, 'idempotency_key' => Str::uuid(), 'sandbox_scenario' => 'success', 'beneficiary_type' => 'logistics', 'beneficiary_id' => $owner->id, 'status' => 'pending', 'currency' => 'PHP', 'amount_cents' => 1000, 'eligible_through' => $at, 'submitted_at' => $at, 'is_sandbox' => true]);
            FinancialHold::create(['order_id' => $record->id, 'reason_code' => 'LOGISTICS_EVIDENCE_MISSING', 'placed_at' => $at]);
        }
        $this->actingAs($organization->user);
        $this->getJson('/api/v1/logistics/finance/invoices'.self::RANGE)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $invoice->id)->assertJsonPath('summary.outstanding_cents', 120000);
        foreach (['remittances', 'payout-history'] as $path) {
            $this->getJson('/api/v1/logistics/finance/'.$path.self::RANGE)->assertOk()->assertJsonPath('total', 1);
        }
        $this->actingAs($this->admin())->getJson('/api/v1/admin/finance/holds'.self::RANGE)->assertOk()->assertJsonPath('meta.total', 2);
        foreach ([$before, $inRange] as $at) {
            FinanceGatewayEvent::create(['sandbox_gateway_transaction_id' => SandboxGatewayTransaction::create(['idempotency_key' => Str::uuid(), 'request_hash' => str_repeat('a', 64), 'direction' => 'collection', 'scenario' => 'success', 'status' => 'pending', 'currency' => 'PHP', 'amount_cents' => 100, 'account_reference' => 'events', 'metadata' => []])->id, 'payload' => ['type' => 'test', 'data' => []], 'created_at' => $at, 'updated_at' => $at]);
        }
        $this->getJson('/api/v1/admin/finance/sandbox'.self::RANGE)->assertOk()->assertJsonCount(1, 'events');
    }

    public function test_all_time_preserves_daily_units_and_csv_is_bounded_and_safe(): void
    {
        $organization = $this->logistics('Export');
        $order = $this->order($organization);
        $this->postRevenue($order->shop_id, $organization->id, '2024-01-05T10:00:00Z', 1234);
        $scope = app(FinanceReportService::class)->scope($order->shop->seller, 'seller');
        $rows = app(FinanceReportService::class)->series($scope, ['all_time' => true]);
        $this->assertCount((int) CarbonImmutable::parse('2024-01-05')->diffInDays(CarbonImmutable::parse('2026-11-05')) + 1, $rows);
        $this->assertSame('2024-01-05', $rows[0]['date']);
        $this->assertSame(1234, $rows[0]['actualRevenueCents']);
        for ($index = 0; $index < 102; $index++) {
            app(LedgerService::class)->post('export:'.$index, '=SUM(1)', 'PHP', [
                ['account_code' => 'cash', 'owner_type' => 'platform', 'debit_cents' => 1],
                ['account_code' => 'commission_revenue', 'owner_type' => 'platform', 'credit_cents' => 1],
            ], CarbonImmutable::parse('2026-11-01T00:00:00Z'));
        }
        $this->actingAs($this->admin());
        $csv = $this->get('/api/v1/admin/finance/ledger.csv'.self::RANGE)->assertOk()->streamedContent();
        $this->assertSame(201, count(explode("\n", trim($csv))));
        $this->assertStringContainsString("'=SUM(1)", $csv);
        $next = $this->get('/api/v1/admin/finance/ledger.csv'.self::RANGE.'&page=2')->streamedContent();
        $this->assertSame(5, count(explode("\n", trim($next))));
    }

    public function test_actual_profit_requires_every_selected_month_to_be_closed(): void
    {
        $organization = $this->logistics('Closed');
        $order = $this->order($organization);
        $this->actingAs($order->shop->seller);
        FinancePeriodClosure::create(['owner_type' => 'seller', 'owner_id' => $order->shop_id, 'period_month' => '2026-10-01', 'costs_complete' => true, 'closed_at' => now(), 'closed_by' => $order->shop->seller_id]);
        $this->getJson('/api/v1/seller/finance/summary?date_from=2026-10-01&date_to=2026-10-31')->assertOk()->assertJsonPath('data.summary.profitState', 'actual');
        $this->getJson('/api/v1/seller/finance/summary?date_from=2026-09-01&date_to=2026-10-31')->assertOk()->assertJsonPath('data.summary.profitState', 'provisional');
        $this->getJson('/api/v1/seller/finance/summary'.self::RANGE)->assertJsonPath('data.summary.profitState', 'provisional');
    }

    private function admin(): User
    {
        $this->seed(AdminPermissionSeeder::class);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $admin->permissions()->attach(Permission::where('slug', 'finance.view')->firstOrFail());

        return $admin;
    }

    private function postRevenue(string $shop, string $organization, string $at, int $amount): void
    {
        app(LedgerService::class)->post('range:'.Str::uuid(), 'range_revenue', 'PHP', [
            ['account_code' => 'cod_receivable', 'owner_type' => 'platform', 'debit_cents' => $amount * 3],
            ['account_code' => 'seller_liability', 'owner_type' => 'seller', 'owner_id' => $shop, 'credit_cents' => $amount],
            ['account_code' => 'logistics_liability', 'owner_type' => 'logistics', 'owner_id' => $organization, 'credit_cents' => $amount],
            ['account_code' => 'commission_revenue', 'owner_type' => 'platform', 'credit_cents' => $amount],
        ], CarbonImmutable::parse($at));
    }
}
