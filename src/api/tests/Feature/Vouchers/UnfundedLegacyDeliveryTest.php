<?php

namespace Tests\Feature\Vouchers;

use App\Enums\DeliveryApprovalMode;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\ShipmentEvent;
use App\Models\User;
use App\Services\Finance\FinanceLifecycleService;
use App\Services\Finance\LogisticsAllocationService;
use App\Services\Logistics\AutomaticDeliveryApprovalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\Support\LegacyShippingVoucherDeliveryFixtures;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class UnfundedLegacyDeliveryTest extends TestCase
{
    use LegacyShippingVoucherDeliveryFixtures, RefreshDatabase, VoucherAuthoringFixtures;

    public function test_old_unfunded_snapshot_blocks_real_proof_approval_and_exact_retries_without_effects(): void
    {
        $context = $this->historicalShortfall();
        $before = $this->deliveryState($context);
        Notification::fake();
        $key = (string) Str::uuid();
        for ($retry = 0; $retry < 3; $retry++) {
            $this->withHeader('Idempotency-Key', $key)
                ->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])
                ->assertConflict()->assertJsonPath('code', 'ORDER_FUNDING_HOLD')
                ->assertHeader('Cache-Control', 'no-store, private');
            $this->assertSame($before, $this->deliveryState($context));
            $this->assertNoDeliveryEffects();
        }
        Notification::assertNothingSent();
        $this->assertSame(1, $context['voucher']->fresh()->redeemed_count);
        $this->asLifecycleActor($context['finalCourier']);
        $this->getJson('/api/v1/courier/tasks/'.$context['task']->id.'/completion')
            ->assertOk()->assertJsonPath('data.task_status', 'out_for_delivery')
            ->assertJsonPath('data.completion_status', 'awaiting_validation')->assertJsonPath('data.delivered_at', null);
    }

    public function test_direct_finance_recognition_rejects_before_any_allocation(): void
    {
        $context = $this->historicalShortfall();
        $before = $this->deliveryState($context);
        $this->mock(LogisticsAllocationService::class, function ($mock): void {
            $mock->shouldNotReceive('allocate');
            $mock->shouldNotReceive('commit');
        });
        try {
            app(FinanceLifecycleService::class)->recognizeDelivery($context['order']->fresh(), $context['task']->shipment, now());
            $this->fail('Historical shortfall must block recognition.');
        } catch (FulfillmentException $error) {
            $this->assertSame(['ORDER_FUNDING_HOLD', 409], [$error->errorCode, $error->status]);
        }
        $this->assertSame($before, $this->deliveryState($context));
        $this->assertNoDeliveryEffects();
    }

    public function test_funding_conflict_does_not_disclose_foreign_orders_or_bypass_role_checks(): void
    {
        $context = $this->historicalShortfall();
        $before = $this->deliveryState($context);
        $foreign = User::factory()->create(['role' => 'logistics', 'status' => 'active']);
        $foreign->logisticsOrganization()->create(['business_name' => 'Foreign organization']);
        $address = $context['origin'][1]->hub->address->replicate();
        $address->user_id = $foreign->id;
        $address->save();
        $foreign->logisticsOrganization->hub()->create([
            'address_id' => $address->id, 'name' => 'Foreign hub',
        ]);
        $this->asLifecycleActor($foreign);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])->assertNotFound();
        $this->asLifecycleActor($context['finalCourier']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])->assertForbidden();
        $this->assertSame($before, $this->deliveryState($context));
        $this->assertNoDeliveryEffects();
    }

    public function test_paid_prepaid_automatic_and_manual_paths_both_hold_an_unfunded_snapshot(): void
    {
        $context = $this->historicalShortfall();
        $context['order']->update(['payment_method' => 'prepaid', 'payment_status' => 'paid']);
        $context['completion']->update(['approval_mode' => DeliveryApprovalMode::Automatic]);
        $before = $this->deliveryState($context);
        app(AutomaticDeliveryApprovalService::class)->approve($context['completion']->id);
        $this->assertSame('ORDER_FUNDING_HOLD', $context['completion']->fresh()->automatic_review_error);
        $after = $this->deliveryState($context);
        // Automatic review persists only its existing safe error/fallback metadata.
        $before['completion']['automatic_review_error'] = 'ORDER_FUNDING_HOLD';
        $before['completion']['updated_at'] = $after['completion']['updated_at'];
        $this->assertSame($before, $after);
        app(AutomaticDeliveryApprovalService::class)->approve($context['completion']->id);
        $this->assertSame($after, $this->deliveryState($context));
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])
            ->assertConflict()->assertJsonPath('code', 'ORDER_FUNDING_HOLD');
        $this->assertSame($after, $this->deliveryState($context));
        $this->assertNoDeliveryEffects();
    }

    public function test_committed_delivery_replay_is_not_revalidated_or_duplicated(): void
    {
        $context = $this->pendingLegacyDelivery('9.00');
        $key = (string) Str::uuid();
        $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])->assertOk();
        // Simulate an imported historical snapshot attached to an already committed event.
        $context['order']->pricingSnapshot()->update(['cod_total_cents' => 1000]);
        $before = $this->deliveryState($context);
        $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/logistics/update-status/transitions', $context['approval'])
            ->assertOk()->assertJsonPath('data.status', 'delivered');
        $this->assertSame($before, $this->deliveryState($context));
        $this->assertDatabaseCount('finance_journal_entries', 1);
        $this->assertDatabaseCount('cod_invoices', 1);
        $this->assertDatabaseCount('courier_cash_obligations', 1);
        $this->assertSame(1, ShipmentEvent::where('event_type', 'delivery_completed')->count());
    }

    private function historicalShortfall(): array
    {
        $context = $this->pendingLegacyDelivery('9.00');
        // Import the audit's pre-fix frozen facts; do not pass through today's checkout guard.
        $snapshot = $context['order']->pricingSnapshot;
        $funding = $snapshot->voucher_funding;
        $funding[0]['amount_cents'] = 2000;
        $snapshot->update(['cod_total_cents' => 1000, 'seller_proceeds_cents' => 0, 'voucher_funding' => $funding]);
        $context['order']->update(['shipping_discount_total' => '20.00', 'payable_total' => '10.00']);
        $context['order']->vouchers()->update(['discount_amount' => '20.00']);
        $context['completion']->update(['cod_declared_amount' => '10.00']);

        return $context;
    }

    private function deliveryState(array $context): array
    {
        return [
            'order' => $context['order']->fresh()->getAttributes(),
            'snapshot' => $context['order']->pricingSnapshot()->sole()->getAttributes(),
            'task' => $context['task']->fresh()->getAttributes(),
            'shipment' => $context['task']->shipment->fresh()->getAttributes(),
            'proof' => $context['proof']->fresh()->getAttributes(),
            'completion' => $context['completion']->fresh()->getAttributes(),
            'status_events' => $context['order']->statusEvents()->get()->toArray(),
            'vouchers' => $context['order']->vouchers()->get()->toArray(),
        ];
    }

    private function assertNoDeliveryEffects(): void
    {
        foreach (['finance_journal_entries', 'finance_ledger_lines', 'logistics_service_allocations', 'cod_invoices', 'courier_cash_obligations'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        $this->assertSame(0, ShipmentEvent::where('event_type', 'delivery_completed')->count());
    }
}
