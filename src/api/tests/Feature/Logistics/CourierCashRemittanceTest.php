<?php

namespace Tests\Feature\Logistics;

use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\CodInvoice;
use App\Models\CourierCashObligation;
use App\Models\SandboxGatewayAccount;
use App\Models\User;
use App\Services\Finance\Automation\CollectionService;
use App\Services\Finance\Automation\PaymentResultService;
use App\Services\Finance\CourierCashCreditService;
use App\Services\Finance\Gateway\LogisticsBillingService;
use App\Services\Finance\Gateway\SandboxGatewayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\DeliveryReviewFixtures;
use Tests\TestCase;

class CourierCashRemittanceTest extends TestCase
{
    use DeliveryReviewFixtures, RefreshDatabase;

    public function test_cod_approval_creates_obligation_and_receipt_credits_once_without_clearing_invoice(): void
    {
        config(['finance.gateway_enabled' => true]);
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->submitIntent($courier, $task, $proof);
        $this->assertDatabaseCount('courier_cash_obligations', 0);
        $key = (string) Str::uuid();
        $this->approveDelivery($logistics, $task, $proof, $key);
        $this->approveDelivery($logistics, $task, $proof, $key);
        $obligation = CourierCashObligation::sole();
        $account = SandboxGatewayAccount::where('reference', 'logistics-'.$obligation->logistics_organization_id)->sole();
        $this->assertSame(0, $account->balance_cents);
        $this->getJson('/api/v1/logistics/finance/courier-cash')->assertOk()->assertJsonPath('balances.0.outstanding_cents', 10000);
        $input = ['obligation_ids' => [$obligation->id], 'confirmed' => true, 'idempotency_key' => (string) Str::uuid()];
        $receipt = $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', $input)->assertOk()->assertJsonPath('data.simulation_credit', 'credited')->json('data');
        $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', $input)->assertOk()->assertJsonPath('data.id', $receipt['id']);
        $this->assertSame(10000, $account->fresh()->balance_cents);
        $this->assertDatabaseCount('courier_cash_receipts', 1);
        $this->assertDatabaseCount('courier_cash_credits', 1);
        $this->assertDatabaseHas('cod_invoices', ['order_id' => $obligation->order_id, 'status' => 'outstanding']);
        $this->getJson('/api/v1/logistics/finance/courier-cash')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/logistics/finance/courier-cash/receipts')->assertOk()->assertJsonPath('data.0.orders.0.reference', $obligation->order_reference);
        $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', [...$input, 'idempotency_key' => (string) Str::uuid()])->assertConflict();
        $invoice = CodInvoice::where('order_id', $obligation->order_id)->sole();
        $attempt = app(CollectionService::class)->pay($obligation->logistics_organization_id, [$invoice->id], (string) Str::uuid());
        $gateway = app(SandboxGatewayService::class);
        $transaction = $gateway->create($attempt->idempotency_key, ['direction' => 'collection', 'amount_cents' => $attempt->amount_cents,
            'currency' => $attempt->currency, 'account_reference' => $attempt->account_reference, 'metadata' => ['attempt_id' => $attempt->id]]);
        $transaction = $gateway->resolve($transaction->id);
        $result = $gateway->object($transaction);
        app(PaymentResultService::class)->apply($attempt->id, $result);
        app(PaymentResultService::class)->apply($attempt->id, $result);
        $this->assertSame(0, $account->fresh()->balance_cents);
        $this->assertSame('paid', $invoice->fresh()->status->value);
    }

    public function test_receipt_survives_disabled_simulation_and_recovers_credit_once(): void
    {
        config(['finance.gateway_enabled' => false]);
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->submitIntent($courier, $task, $proof);
        $this->approveDelivery($logistics, $task, $proof);
        $obligation = CourierCashObligation::sole();
        $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', [
            'obligation_ids' => [$obligation->id], 'confirmed' => true, 'idempotency_key' => (string) Str::uuid(),
        ])->assertOk()->assertJsonPath('data.simulation_credit', 'pending');
        $account = SandboxGatewayAccount::where('reference', 'logistics-'.$obligation->logistics_organization_id)->sole();
        $this->assertSame(0, $account->balance_cents);
        config(['finance.gateway_enabled' => true]);
        app(CourierCashCreditService::class)->recover();
        app(CourierCashCreditService::class)->recover();
        $this->assertSame(10000, $account->fresh()->balance_cents);
    }

    public function test_mixed_couriers_currencies_partial_amounts_and_foreign_obligations_fail_closed(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->submitIntent($courier, $task, $proof);
        $this->approveDelivery($logistics, $task, $proof);
        $first = CourierCashObligation::sole();
        $order = $task->shipment->parcel->order->replicate();
        $batch = CheckoutBatch::findOrFail($order->checkout_batch_id)->replicate();
        $quote = CheckoutQuote::findOrFail($batch->checkout_quote_id)->replicate();
        $quote->save();
        $batch->checkout_quote_id = $quote->id;
        $batch->idempotency_key = (string) Str::uuid();
        $batch->save();
        $order->checkout_batch_id = $batch->id;
        $order->reference = 'AIS-'.Str::uuid();
        $order->save();
        $second = $first->replicate();
        $second->order_id = $order->id;
        $second->order_reference = $order->reference;
        $second->courier_id = User::factory()->create(['role' => 'courier', 'status' => 'active'])->id;
        $second->save();
        $input = ['obligation_ids' => [$first->id, $second->id], 'confirmed' => true, 'idempotency_key' => (string) Str::uuid()];
        $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', $input)->assertStatus(422);
        $second->update(['courier_id' => $courier->id, 'currency' => 'USD']);
        $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', $input)->assertStatus(422);
        $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', [...$input, 'amount_cents' => 1])->assertStatus(422);
        $this->postJson('/api/v1/logistics/finance/courier-cash/receipts', [...$input, 'confirmed' => false])->assertStatus(422);
        $foreign = $this->logistics();
        $this->actingAs($foreign)->postJson('/api/v1/logistics/finance/courier-cash/receipts', $input)->assertNotFound();
        $this->getJson('/api/v1/logistics/finance/courier-cash')->assertOk()->assertJsonCount(0, 'data');
        $this->assertDatabaseCount('courier_cash_receipts', 0);
    }

    public function test_billing_provisions_zero_balance_masks_account_and_preserves_funded_accounts(): void
    {
        $logistics = $this->logistics();
        $account = app(LogisticsBillingService::class)->provision($logistics->logisticsOrganization);
        $this->assertSame(0, $account->balance_cents);
        $account->update(['balance_cents' => 12345]);
        $response = $this->actingAs($logistics)->getJson('/api/v1/logistics/finance/billing')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $data = $response->json('data');
        $this->assertMatchesRegularExpression('/^••••[0-9]{4}$/u', $data['masked_identifier']);
        $this->assertArrayNotHasKey('balance_cents', $data);
        $this->assertArrayNotHasKey('reference', $data);
        $this->assertSame(12345, $account->fresh()->balance_cents);
        $this->assertDatabaseCount('sandbox_gateway_accounts', 1);
        $this->actingAs(User::factory()->create(['role' => 'customer', 'status' => 'active']))->getJson('/api/v1/logistics/finance/billing')->assertForbidden();
        $this->assertDatabaseCount('courier_cash_obligations', 0);
    }
}
