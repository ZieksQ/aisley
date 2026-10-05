<?php

namespace Tests\Feature\Logistics;

use App\Enums\DeliveryApprovalMode;
use App\Jobs\Logistics\ApprovePrepaidDelivery;
use App\Models\LogisticsOrganization;
use App\Models\OrderPricingSnapshot;
use App\Models\ShipmentEvent;
use App\Models\User;
use App\Services\Logistics\AutomaticDeliveryApprovalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\DeliveryReviewFixtures;
use Tests\Support\FinanceAutomationFixtures;
use Tests\TestCase;

class DeliveryApprovalTest extends TestCase
{
    use DeliveryReviewFixtures, RefreshDatabase;

    public function test_prepaid_auto_approval_uses_snapshot_and_system_attribution_once(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery(true);
        $pricing = new class
        {
            use FinanceAutomationFixtures;

            public function snapshot(LogisticsOrganization $organization): OrderPricingSnapshot
            {
                return $this->order($organization)->pricingSnapshot;
            }
        };
        $pricing->snapshot($logistics->logisticsOrganization)->update(['order_id' => $task->shipment->parcel->order_id]);
        $this->actingAs($logistics)->patchJson('/api/v1/logistics/delivery-approval-settings', ['mode' => 'automatic'])->assertOk();
        $intent = $this->submitIntent($courier, $task, $proof, false);
        $this->assertSame(DeliveryApprovalMode::Automatic, $intent->approval_mode);
        Queue::assertPushed(ApprovePrepaidDelivery::class, fn ($job) => $job->intentId === $intent->id);
        $this->actingAs($logistics)->patchJson('/api/v1/logistics/delivery-approval-settings', ['mode' => 'manual'])->assertOk();
        app(AutomaticDeliveryApprovalService::class)->approve($intent->id);
        app(AutomaticDeliveryApprovalService::class)->approve($intent->id);
        $this->assertSame('delivered', $task->fresh()->status->value);
        $this->assertNull($proof->fresh()->validated_by_logistics_id);
        $this->assertSame(DeliveryApprovalMode::Automatic, $proof->fresh()->review_method);
        $this->assertDatabaseCount('shipment_events', 1);
        $this->assertDatabaseCount('courier_cash_obligations', 0);
        $this->assertDatabaseCount('cod_invoices', 0);
        $this->assertDatabaseCount('finance_journal_entries', 0);
        $this->assertDatabaseCount('logistics_service_allocations', 0);
        $this->getJson('/api/v1/logistics/delivery-confirmations?view=history')->assertOk()->assertJsonPath('data.0.review.reviewer', 'System')->assertJsonPath('data.0.proof.status', 'validated');
        $this->actingAs($courier)->getJson('/api/v1/courier/tasks/'.$task->id.'/completion')->assertOk()->assertJsonPath('data.task_status', 'delivered');
    }

    public function test_cod_is_manual_even_when_organization_enables_automatic_and_old_intents_stay_manual(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $intent = $this->submitIntent($courier, $task, $proof);
        $this->actingAs($logistics)->patchJson('/api/v1/logistics/delivery-approval-settings', ['mode' => 'automatic'])->assertOk();
        app(AutomaticDeliveryApprovalService::class)->approve($intent->id);
        $this->assertSame('out_for_delivery', $task->fresh()->status->value);
        $this->assertSame(DeliveryApprovalMode::Manual, $intent->fresh()->approval_mode);
        Queue::assertNotPushed(ApprovePrepaidDelivery::class);
        $this->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonPath('data.0.cod.collected', true);
        $this->approveDelivery($logistics, $task, $proof);
        $this->assertSame($logistics->id, ShipmentEvent::sole()->recorded_by_logistics_id);
    }

    public function test_correction_preserves_pending_order_and_exposes_reason_without_allowing_completion(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $intent = $this->submitIntent($courier, $task, $proof);
        $this->actingAs($logistics)->postJson('/api/v1/logistics/delivery-proofs/'.$proof->id.'/reject', ['reason' => 'Show the parcel at the destination.', 'expected_revision' => 5])->assertOk();
        $this->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/logistics/delivery-confirmations?view=history')->assertOk()->assertJsonPath('data.0.review.reason', 'Show the parcel at the destination.');
        $this->assertSame('rejected', $intent->fresh()->status->value);
        $this->assertSame('out_for_delivery', $task->fresh()->status->value);
        $this->assertDatabaseCount('courier_cash_obligations', 0);
        $this->actingAs($courier)->getJson('/api/v1/courier/tasks/'.$task->id.'/completion')->assertOk()->assertJsonPath('data.rejection_reason', 'Show the parcel at the destination.');
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $task->shipment->parcel->waybill->reference, 'target_state' => 'delivered', 'expected_revision' => 5, 'evidence_id' => $proof->id,
        ])->assertConflict();
    }

    public function test_auto_conflict_falls_back_to_manual_and_missing_storage_does_not_deliver(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery(true);
        $logistics->logisticsOrganization->update(['delivery_approval_mode' => 'automatic']);
        $intent = $this->submitIntent($courier, $task, $proof, false);
        Storage::disk($proof->storage_disk)->delete($proof->storage_path);
        app(AutomaticDeliveryApprovalService::class)->approve($intent->id);
        $this->assertSame('out_for_delivery', $task->fresh()->status->value);
        $this->assertNotNull($intent->fresh()->automatic_review_error);
        $this->assertDatabaseCount('shipment_events', 0);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonPath('data.0.intent.automatic_review_error', 'COMPLETION_STATE_CONFLICT');
    }

    public function test_prepaid_payment_and_stale_intent_revision_are_rechecked(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery(true);
        $logistics->logisticsOrganization->update(['delivery_approval_mode' => 'automatic']);
        $intent = $this->submitIntent($courier, $task, $proof, false);
        $task->shipment->parcel->order->update(['payment_status' => 'pending']);
        app(AutomaticDeliveryApprovalService::class)->approve($intent->id);
        $this->assertSame('PREPAID_PAYMENT_REQUIRED', $intent->fresh()->automatic_review_error);
        $this->assertSame('out_for_delivery', $task->fresh()->status->value);
        $intent->refresh()->update(['automatic_review_error' => null]);
        $task->update(['revision' => 6]);
        app(AutomaticDeliveryApprovalService::class)->approve($intent->id);
        $this->assertSame('COMPLETION_STATE_CONFLICT', $intent->fresh()->automatic_review_error);
    }

    public function test_reads_settings_and_photos_are_role_and_tenant_scoped(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->submitIntent($courier, $task, $proof);
        $foreign = $this->logistics();
        $this->actingAs($foreign)->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $this->get('/api/v1/logistics/delivery-proofs/'.$proof->id.'/photo')->assertNotFound();
        $this->patchJson('/api/v1/logistics/delivery-approval-settings', ['mode' => 'automatic'])->assertOk();
        $this->assertSame(DeliveryApprovalMode::Manual, $logistics->logisticsOrganization->fresh()->delivery_approval_mode);
        $this->actingAs(User::factory()->create(['role' => 'customer', 'status' => 'active']))->getJson('/api/v1/logistics/delivery-approval-settings')->assertForbidden();
        $this->actingAs($logistics)->patchJson('/api/v1/logistics/delivery-approval-settings', ['mode' => 'bad'])->assertStatus(422);
    }

    public function test_lost_automatic_job_is_redispatched_but_fallbacks_are_not(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery(true);
        $logistics->logisticsOrganization->update(['delivery_approval_mode' => 'automatic']);
        $intent = $this->submitIntent($courier, $task, $proof, false);
        $intent->forceFill(['updated_at' => now()->subMinutes(6)])->save();
        app(AutomaticDeliveryApprovalService::class)->recover();
        Queue::assertPushed(ApprovePrepaidDelivery::class, 2);
        $intent->refresh()->forceFill(['automatic_review_error' => 'MANUAL_REVIEW_REQUIRED', 'updated_at' => now()->subMinutes(6)])->save();
        app(AutomaticDeliveryApprovalService::class)->recover();
        Queue::assertPushed(ApprovePrepaidDelivery::class, 2);
    }
}
