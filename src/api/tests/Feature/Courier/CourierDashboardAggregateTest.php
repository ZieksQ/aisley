<?php

namespace Tests\Feature\Courier;

use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\Shipment;
use App\Services\Courier\CourierNotificationService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class CourierDashboardAggregateTest extends TestCase
{
    use LocalSortingFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['hub-routing.enabled' => false]);
    }

    public function test_empty_sections_are_real_empty_reads_and_versions_are_validated(): void
    {
        [, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $this->actingAs($courier)->getJson('/api/v1/courier/dashboard?version=2')
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('meta.version', 2)->assertJsonPath('freshness.state', 'fresh')
            ->assertJsonPath('sections.notifications.state', 'empty')
            ->assertJsonPath('sections.available_tasks.data', [])
            ->assertJsonPath('sections.active_tasks.has_more', false);
        $this->getJson('/api/v1/courier/dashboard?version=3')->assertUnprocessable();
    }

    public function test_combined_previews_are_bounded_ordered_scoped_and_have_no_side_effects(): void
    {
        $this->freezeTime();
        [$logistics, $courier] = $this->receivedParcels(7);
        $organization = $logistics->logisticsOrganization;
        $hub = $organization->hub;
        $shipments = Shipment::query()->orderBy('id')->get();
        foreach ($shipments as $shipment) {
            DeliveryTask::create(['shipment_id' => $shipment->id, 'courier_id' => $courier->id,
                'leg' => FulfillmentTaskLeg::FinalMile, 'status' => FulfillmentTaskStatus::DeliveryAssigned,
                'revision' => 3]);
        }
        $first = FirstMileTask::query()->firstOrFail();
        $first->forceFill(['status' => FirstMileTaskStatus::Assigned, 'created_at' => now()->subDay()])->save();
        $active = DeliveryTask::query()->where('leg', FulfillmentTaskLeg::FinalMile)->firstOrFail();
        $active->update(['status' => FulfillmentTaskStatus::InTransit]);
        $before = $this->snapshot();
        $response = $this->actingAs($courier)->getJson('/api/v1/courier/dashboard?version=2')
            ->assertOk()->assertJsonCount(5, 'sections.available_tasks.data')
            ->assertJsonPath('sections.available_tasks.has_more', true)
            ->assertJsonPath('sections.available_tasks.data.0.id', $first->id)
            ->assertJsonPath('sections.available_tasks.data.0.leg', 'first_mile')
            ->assertJsonPath('sections.active_tasks.data.0.id', $active->id)
            ->assertJsonPath('sections.active_tasks.data.0.revision', 3);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame($response->json(), $this->getJson('/api/v1/courier/dashboard?version=2')->json());
        $row = $response->json('sections.available_tasks.data.0');
        $this->assertSame(['id', 'leg', 'status', 'revision', 'order_reference', 'waybill_reference', 'schedule_id', 'created_at'], array_keys($row));
        $this->assertNotNull($row['schedule_id']);

        $other = $this->courier($organization->id, $hub->id);
        $this->actingAs($other)->getJson('/api/v1/courier/dashboard?version=2')
            ->assertOk()->assertJsonPath('sections.available_tasks.state', 'empty')
            ->assertJsonPath('sections.active_tasks.state', 'empty');
        $active->shipment->update(['current_hub_id' => $this->logistics()[2]->id]);
        $this->actingAs($courier)->getJson('/api/v1/courier/dashboard?version=2')
            ->assertOk()->assertJsonPath('sections.active_tasks.state', 'empty');
    }

    public function test_notification_query_failure_is_partial_and_safe(): void
    {
        [, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $this->partialMock(CourierNotificationService::class, function ($mock) {
            $mock->shouldReceive('list')->once()->andThrow(new QueryException('sqlite', 'private sql', [], new \Exception('private failure')));
        });
        $this->actingAs($courier)->getJson('/api/v1/courier/dashboard?version=2')
            ->assertOk()->assertJsonPath('freshness.state', 'partial')
            ->assertJsonPath('sections.notifications.state', 'failed')
            ->assertJsonPath('sections.notifications.generated_at', null)
            ->assertJsonPath('sections.available_tasks.state', 'empty')
            ->assertDontSee('private failure')->assertDontSee('private sql');
    }

    public function test_versioned_reads_enforce_account_affiliation_and_role_gates(): void
    {
        $this->getJson('/api/v1/courier/dashboard?version=2')->assertUnauthorized();
        [, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $this->actingAs($courier)->getJson('/api/v1/courier/dashboard?version=2&courier_id=foreign')
            ->assertUnprocessable()->assertJsonValidationErrors('courier_id');
        $courier->courierLogisticsAffiliation()->update(['status' => 'pending']);
        $this->getJson('/api/v1/courier/dashboard?version=2')->assertForbidden();
        $courier->update(['role' => 'customer']);
        $this->getJson('/api/v1/courier/dashboard?version=2')->assertForbidden();
    }

    public function test_all_active_final_states_and_first_mile_tenant_isolation(): void
    {
        [$logistics, $courier] = $this->receivedParcels(5);
        $statuses = [FulfillmentTaskStatus::DeliveryAccepted, FulfillmentTaskStatus::PickedUpFromHub,
            FulfillmentTaskStatus::InTransit, FulfillmentTaskStatus::OutForDelivery, FulfillmentTaskStatus::Delivered];
        foreach (Shipment::query()->get() as $index => $shipment) {
            DeliveryTask::create(['shipment_id' => $shipment->id, 'courier_id' => $courier->id,
                'leg' => FulfillmentTaskLeg::FinalMile, 'status' => $statuses[$index], 'revision' => 1]);
        }
        $first = FirstMileTask::query()->firstOrFail();
        $first->update(['status' => FirstMileTaskStatus::Accepted]);
        $this->actingAs($courier)->getJson('/api/v1/courier/dashboard?version=2')->assertOk()
            ->assertJsonCount(5, 'sections.active_tasks.data')
            ->assertJsonPath('sections.active_tasks.has_more', false)
            ->assertJsonPath('sections.available_tasks.state', 'empty');
        [, $foreignOrganization, $foreignHub] = $this->logistics();
        $first->update(['logistics_organization_id' => $foreignOrganization->id, 'logistics_hub_id' => $foreignHub->id]);
        $this->getJson('/api/v1/courier/dashboard?version=2')->assertOk()
            ->assertJsonCount(4, 'sections.active_tasks.data');
    }

    private function snapshot(): array
    {
        return collect(['first_mile_tasks', 'delivery_tasks', 'orders', 'shipment_events', 'notifications'])
            ->mapWithKeys(fn ($table) => [$table => DB::table($table)->orderBy('id')->get()->toJson()])->all();
    }
}
