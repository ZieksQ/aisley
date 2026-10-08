<?php

namespace Tests\Feature\Vouchers;

use App\Models\CommissionPolicy;
use App\Models\FinanceJournalEntry;
use App\Models\Order;
use App\Models\SandboxGatewayAccount;
use App\Services\Finance\Automation\CodInvoiceService;
use App\Services\Finance\Automation\PaymentResultService;
use App\Services\Finance\Automation\PayoutService;
use App\Services\Finance\FinanceLifecycleService;
use App\Services\Finance\FinanceWorkflowService;
use App\Services\Finance\Gateway\SandboxGatewayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\OrderLifecycleFixtures;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class VoucherFundingTest extends TestCase
{
    use OrderLifecycleFixtures, RefreshDatabase, VoucherAuthoringFixtures;

    public static function fundingCases(): array
    {
        return [
            'Seller merchandise' => ['seller', 'discount', 'percent', 10, 18000, 16200, 19000, 0],
            'App merchandise' => ['admin', 'discount', 'fixed', 20, 20000, 18000, 19000, 2000],
            'App shipping' => ['admin', 'shipping', 'fixed', 5, 20000, 18000, 20500, 500],
        ];
    }

    #[DataProvider('fundingCases')]
    public function test_authored_funding_flows_once_through_checkout_delivery_ledger_and_payout(string $role, string $benefit, string $valueType, int $value, int $base, int $sellerProceeds, int $cod, int $expense): void
    {
        Queue::fake();
        Http::preventStrayRequests();
        config(['finance.gateway_enabled' => true, 'hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
        $context = $this->lifecycleContext(false);
        CommissionPolicy::query()->update(['rate_basis_points' => 1000]);
        $admin = $this->voucherActor();
        $this->asLifecycleActor($role === 'seller' ? $context['seller'] : $admin);
        $voucher = $this->voucherAction($this->draftVoucher($role, ['benefit_type' => $benefit, 'value_type' => $valueType, 'value' => $value]), 'publish', $role)->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        $intent = [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 2],
            'address_id' => $context['address']->id, 'payment_method' => 'cod',
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
            'vouchers' => [['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id]],
        ];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $placed = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk()->json('data');
        $order = Order::findOrFail($placed['orders'][0]['id']);
        $this->assertSame([$base, $sellerProceeds, 900, $cod], [$order->pricingSnapshot->seller_commission_base_cents, $order->pricingSnapshot->seller_proceeds_cents, $order->pricingSnapshot->logistics_pool_cents, $order->pricingSnapshot->cod_total_cents]);
        // Obtain the actual frozen route through Seller approval/readiness. Delivery evidence
        // is simulated below to isolate finance; OrderLifecycleTest covers full POD transitions.
        $this->asLifecycleActor($context['seller']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/'.$order->id.'/approve')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $context['seller']->addresses()->where('label', 'Pickup')->sole()->id,
            'logistics_organization_id' => $context['origin'][1]->id,
        ])->assertOk();
        $order->refresh()->load('waybill');
        $this->asLifecycleActor($context['origin'][0]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $context['firstCourier']->id,
            'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated();
        $this->asLifecycleActor($context['firstCourier']);
        $task = $this->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson('/api/v1/courier/first-mile-tasks/'.$task['id'].'/accept')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/first-mile-tasks/'.$task['id'].'/pickup', [
            'identifier_type' => 'tracking_id', 'identifier' => $order->waybill->reference,
        ])->assertOk();
        $this->asLifecycleActor($context['origin'][0]);
        $this->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $order->waybill->reference, 'scanned_at' => now()->toISOString(),
        ]]])->assertOk();
        $order->refresh()->load('waybill.parcel.shipment');
        $shipment = $order->waybill->parcel->shipment;
        $order->update(['status' => 'delivered', 'payment_status' => 'paid']);
        app(FinanceLifecycleService::class)->recognizeDelivery($order, $shipment, now());
        $journal = FinanceJournalEntry::where('order_id', $order->id)->where('event_type', 'delivery_recognized')->sole();
        $this->assertSame($journal->lines()->sum('debit_cents'), $journal->lines()->sum('credit_cents'));
        $this->assertSame($expense, (int) $journal->lines()->where('account_code', 'voucher_expense')->sum('debit_cents'));
        $this->assertSame($sellerProceeds, (int) $journal->lines()->where('account_code', 'seller_liability')->sum('credit_cents'));
        $this->assertSame(900, (int) $journal->lines()->where('account_code', 'logistics_liability')->sum('credit_cents'));
        app(CodInvoiceService::class)->issue($order, $context['origin'][1]->id, now());
        $remittance = app(FinanceWorkflowService::class)->submitRemittance($context['origin'][0], 'VOUCHER-'.Str::uuid(), 'PHP', [['order_id' => $order->id, 'amount_cents' => $cod]]);
        app(FinanceWorkflowService::class)->clearRemittance($admin, $remittance->id);
        $this->travel(15)->days();
        $payouts = app(PayoutService::class);
        $key = (string) Str::uuid();
        $sellerAttempt = $payouts->pay('seller', $order->shop_id, [$order->id], $key);
        $this->assertSame($sellerProceeds, $sellerAttempt->amount_cents);
        $this->assertTrue($sellerAttempt->is($payouts->pay('seller', $order->shop_id, [$order->id], $key)));
        $logisticsAttempt = $payouts->pay('logistics', $context['origin'][1]->id, [$order->id], (string) Str::uuid());
        $this->assertSame(900, $logisticsAttempt->amount_cents);
        SandboxGatewayAccount::updateOrCreate(['reference' => 'platform'], ['balance_cents' => $cod, 'scenario' => 'success']);
        $gateway = app(SandboxGatewayService::class);
        foreach ([$sellerAttempt, $logisticsAttempt] as $attempt) {
            $beforeBalance = SandboxGatewayAccount::where('reference', $attempt->account_reference)->sole()->balance_cents;
            $transaction = $gateway->create($attempt->idempotency_key, [
                'direction' => $attempt->direction->value, 'amount_cents' => $attempt->amount_cents,
                'currency' => $attempt->currency, 'account_reference' => $attempt->account_reference,
                'metadata' => ['attempt_id' => $attempt->id],
            ]);
            $object = $gateway->object($gateway->resolve($transaction->id, 'success'));
            app(PaymentResultService::class)->apply($attempt->id, $object);
            app(PaymentResultService::class)->apply($attempt->id, $object);
            $gateway->resolve($transaction->id, 'success');
            $this->assertSame('succeeded', $attempt->fresh()->status->value);
            $this->assertSame($beforeBalance + $attempt->amount_cents, SandboxGatewayAccount::where('reference', $attempt->account_reference)->sole()->balance_cents);
        }
        $this->assertSame($cod - $sellerProceeds - 900, SandboxGatewayAccount::where('reference', 'platform')->sole()->balance_cents);
        foreach (FinanceJournalEntry::with('lines')->get() as $entry) {
            $this->assertSame($entry->lines->sum('debit_cents'), $entry->lines->sum('credit_cents'));
        }
    }
}
