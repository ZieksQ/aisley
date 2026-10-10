<?php

namespace Tests\Feature\Vouchers;

use App\Models\FinanceJournalEntry;
use App\Models\SandboxGatewayAccount;
use App\Models\ShipmentEvent;
use App\Services\Finance\Automation\PaymentResultService;
use App\Services\Finance\Automation\PayoutService;
use App\Services\Finance\FinanceWorkflowService;
use App\Services\Finance\Gateway\SandboxGatewayService;
use App\Services\Finance\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\LegacyShippingVoucherDeliveryFixtures;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class LegacyShippingVoucherDeliveryTest extends TestCase
{
    use LegacyShippingVoucherDeliveryFixtures, RefreshDatabase, VoucherAuthoringFixtures;

    public static function fundedDeliveries(): array
    {
        return ['below capacity' => ['8.00', 100], 'exact capacity' => ['9.00', 0]];
    }

    #[DataProvider('fundedDeliveries')]
    public function test_real_proof_approval_balances_and_settles_funded_legacy_voucher_once(string $saving, int $sellerProceeds): void
    {
        $context = $this->pendingLegacyDelivery($saving);
        $order = $context['order'];
        $snapshot = $order->pricingSnapshot->getAttributes();
        $key = (string) Str::uuid();
        for ($retry = 0; $retry < 2; $retry++) {
            $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])->assertOk()->assertJsonPath('data.status', 'delivered');
        }
        $this->assertSame(['delivered', 'paid'], [$order->fresh()->status->value, $order->fresh()->payment_status->value]);
        $this->assertSame('validated', $context['proof']->fresh()->status->value);
        $this->assertSame('validated', $context['completion']->fresh()->status->value);
        $this->assertSame($snapshot, $order->pricingSnapshot()->sole()->getAttributes());
        $this->assertSame(1, $context['voucher']->fresh()->redeemed_count);
        $journal = FinanceJournalEntry::where('order_id', $order->id)->where('event_type', 'delivery_recognized')->sole();
        $this->assertSame($sellerProceeds, (int) $journal->lines()->where('account_code', 'seller_liability')->sum('credit_cents'));
        $this->assertSame(1800, (int) $journal->lines()->where('account_code', 'logistics_liability')->sum('credit_cents'));
        $this->assertSame(300, (int) $journal->lines()->where('account_code', 'commission_revenue')->sum('credit_cents'));
        $this->assertSame(0, (int) $journal->lines()->where('account_code', 'voucher_expense')->sum('debit_cents'));
        $this->assertDatabaseCount('cod_invoices', 1);
        $this->assertDatabaseCount('courier_cash_obligations', 1);
        $this->assertSame(1, ShipmentEvent::where('event_type', 'delivery_completed')->count());
        $admin = $this->voucherActor();
        $cod = $order->pricingSnapshot->cod_total_cents;
        $remittance = app(FinanceWorkflowService::class)->submitRemittance($context['origin'][0], 'LEGACY-'.Str::uuid(), 'PHP', [['order_id' => $order->id, 'amount_cents' => $cod]]);
        app(FinanceWorkflowService::class)->clearRemittance($admin, $remittance->id);
        $this->travel(15)->days();
        $payouts = app(PayoutService::class);
        $sellerKey = (string) Str::uuid();
        $sellerAttempt = $payouts->pay('seller', $order->shop_id, [$order->id], $sellerKey);
        if ($sellerProceeds === 0) {
            $this->assertNull($sellerAttempt);
            $this->assertDatabaseMissing('finance_payouts', ['beneficiary_type' => 'seller', 'beneficiary_id' => $order->shop_id]);
        } else {
            $this->assertSame($sellerProceeds, $sellerAttempt->amount_cents);
            $this->assertTrue($sellerAttempt->is($payouts->pay('seller', $order->shop_id, [$order->id], $sellerKey)));
        }
        $logisticsAttempt = $payouts->pay('logistics', $context['origin'][1]->id, [$order->id], (string) Str::uuid());
        $this->assertSame(1800, $logisticsAttempt->amount_cents);
        SandboxGatewayAccount::updateOrCreate(['reference' => 'platform'], ['balance_cents' => $cod, 'scenario' => 'success']);
        $gateway = app(SandboxGatewayService::class);
        foreach (array_filter([$sellerAttempt, $logisticsAttempt]) as $attempt) {
            $before = SandboxGatewayAccount::where('reference', $attempt->account_reference)->sole()->balance_cents;
            $transaction = $gateway->create($attempt->idempotency_key, [
                'direction' => $attempt->direction->value, 'amount_cents' => $attempt->amount_cents,
                'currency' => $attempt->currency, 'account_reference' => $attempt->account_reference, 'metadata' => ['attempt_id' => $attempt->id],
            ]);
            $object = $gateway->object($gateway->resolve($transaction->id, 'success'));
            app(PaymentResultService::class)->apply($attempt->id, $object);
            app(PaymentResultService::class)->apply($attempt->id, $object);
            $this->assertSame('succeeded', $attempt->fresh()->status->value);
            $this->assertSame($before + $attempt->amount_cents, SandboxGatewayAccount::where('reference', $attempt->account_reference)->sole()->balance_cents);
        }
        $this->assertSame(300, SandboxGatewayAccount::where('reference', 'platform')->sole()->balance_cents);
        foreach (FinanceJournalEntry::with('lines')->get() as $entry) {
            $this->assertSame($entry->lines->sum('debit_cents'), $entry->lines->sum('credit_cents'));
        }
    }

    public function test_recognition_failure_rolls_back_proof_finalization_and_retry_commits_once(): void
    {
        $ledger = app(LedgerService::class);
        $fail = true;
        $this->mock(LedgerService::class, function ($mock) use ($ledger, &$fail): void {
            $mock->shouldReceive('post')->andReturnUsing(function (...$args) use ($ledger, &$fail) {
                $journal = $ledger->post(...$args);
                if ($args[1] === 'delivery_recognized' && $fail) {
                    $fail = false;
                    throw new RuntimeException('Injected failure after delivery journal insertion.');
                }

                return $journal;
            });
        });
        $context = $this->pendingLegacyDelivery('9.00');
        $order = $context['order'];
        $before = [$order->getAttributes(), $context['task']->getAttributes(), $context['task']->shipment->getAttributes(), $context['proof']->getAttributes(), $context['completion']->getAttributes()];
        $key = (string) Str::uuid();
        $this->withoutExceptionHandling();
        try {
            $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/logistics/update-status/transitions', $context['approval']);
            $this->fail('Injected recognition failure should propagate.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Injected failure after delivery journal insertion.', $exception->getMessage());
        } finally {
            $this->withExceptionHandling();
        }
        $this->assertSame($before, [$order->fresh()->getAttributes(), $context['task']->fresh()->getAttributes(), $context['task']->shipment->fresh()->getAttributes(), $context['proof']->fresh()->getAttributes(), $context['completion']->fresh()->getAttributes()]);
        foreach (['finance_journal_entries', 'finance_ledger_lines', 'logistics_service_allocations', 'cod_invoices', 'courier_cash_obligations'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        $this->assertSame(0, ShipmentEvent::where('event_type', 'delivery_completed')->count());
        for ($retry = 0; $retry < 2; $retry++) {
            $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])->assertOk();
        }
        $this->assertSame(['delivered', 'paid'], [$order->fresh()->status->value, $order->fresh()->payment_status->value]);
        $this->assertDatabaseCount('finance_journal_entries', 1);
        $this->assertDatabaseCount('cod_invoices', 1);
        $this->assertDatabaseCount('courier_cash_obligations', 1);
        $journal = FinanceJournalEntry::with('lines')->sole();
        $this->assertSame(2100, $journal->lines->sum('debit_cents'));
        $this->assertSame(2100, $journal->lines->sum('credit_cents'));
    }
}
