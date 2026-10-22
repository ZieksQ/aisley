<?php

namespace Tests\Feature\Logistics;

use App\Models\DeliveryTask;
use App\Models\Shipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class FinalMileParcelDecisionsTest extends TestCase
{
    use LocalSortingFixtures;
    use RefreshDatabase;

    public function test_independent_decisions_release_only_rejected_parcel_for_a_new_schedule(): void
    {
        $migration = require database_path('migrations/2026_10_22_000004_allow_rejected_parcel_dispatch_rescheduling.php');
        $migration->down();
        $migration->up();
        config(['hub-routing.enabled' => false]);
        [$logistics, $courier, $references] = $this->receivedParcels(3);
        $records = [];
        foreach ($references as $reference) {
            $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
            $records[] = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
                'reference' => $reference, 'target_state' => 'sorted_at_hub', 'expected_revision' => $record['revision'],
            ])->assertOk()->json('data');
        }
        $schedule = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => array_column($records, 'shipment_id'), 'courier_id' => $courier->id,
            'scheduled_for' => now()->addHour()->toISOString(),
        ])->assertCreated()->json('data');
        $batch = $this->actingAs($courier)->getJson('/api/v1/courier/final-mile-batches/'.$schedule['id'])->assertOk()->json('data');
        [$accepted, $rejected, $untouched] = array_column($batch['tasks'], 'task_id');
        $this->postJson("/api/v1/courier/final-mile-tasks/{$accepted}/accept")->assertOk()->assertJsonPath('data.status', 'delivery_accepted');
        $revision = DeliveryTask::findOrFail($accepted)->revision;
        $this->postJson("/api/v1/courier/final-mile-tasks/{$accepted}/accept")->assertOk()->assertJsonPath('data.revision', $revision);
        $this->assertDatabaseHas('delivery_tasks', ['id' => $untouched, 'status' => 'delivery_assigned', 'accepted_at' => null]);
        $this->getJson('/api/v1/courier/final-mile-batches/'.$schedule['id'].'/route')->assertOk()->assertJsonPath('data.reason', 'missing_hub_coordinates');
        $logistics->logisticsOrganization->hub->address->update(['latitude' => 14.6, 'longitude' => 120.98]);
        DeliveryTask::findOrFail($accepted)->shipment->parcel->order->address->update(['latitude' => 14.2, 'longitude' => 121.1]);
        config(['services.geoapify.server_key' => '']);
        $this->getJson('/api/v1/courier/final-mile-batches/'.$schedule['id'].'/route')->assertOk()
            ->assertJsonPath('data.reason', 'provider_unconfigured')->assertJsonCount(2, 'data.stops')
            ->assertJsonPath('data.stops.1.task_id', $accepted);

        $key = (string) Str::uuid();
        $input = ['reason' => 'Unable to deliver this parcel'];
        $this->withHeader('Idempotency-Key', $key)->postJson("/api/v1/courier/final-mile-tasks/{$rejected}/reject", $input)->assertOk()->assertJsonPath('data.status', 'rejected');
        $task = DeliveryTask::findOrFail($rejected);
        $shipment = Shipment::findOrFail($task->shipment_id);
        $this->assertSame('sorted_at_hub', $shipment->status->value);
        $this->assertNull($task->courier_id);
        $this->assertSame('assigned', $shipment->parcel->order->status->value);
        $this->withHeader('Idempotency-Key', $key)->postJson("/api/v1/courier/final-mile-tasks/{$rejected}/reject", $input)->assertOk()->assertJsonPath('data.revision', $task->revision);
        $this->assertSame($shipment->revision, $shipment->fresh()->revision);
        $this->withHeader('Idempotency-Key', $key)->postJson("/api/v1/courier/final-mile-tasks/{$rejected}/reject", ['reason' => 'Changed reason'])->assertConflict();
        $this->postJson("/api/v1/courier/final-mile-tasks/{$rejected}/accept")->assertNotFound();
        $this->getJson('/api/v1/courier/final-mile-batches/'.$schedule['id'])->assertOk()->assertJsonCount(2, 'data.tasks');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$accepted}/reject", $input)->assertConflict();

        $this->actingAs($logistics)->getJson('/api/v1/logistics/dashboard/queue?status=sorted_at_hub')->assertOk()
            ->assertJsonFragment(['shipment_id' => $shipment->id]);
        $newSchedule = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => [$shipment->id], 'courier_id' => $courier->id,
            'scheduled_for' => now()->addHours(2)->toISOString(),
        ])->assertCreated()->json('data');
        $this->assertDatabaseCount('delivery_tasks', 6); // First- and final-mile per parcel, never duplicated.
        $this->assertDatabaseHas('delivery_task_offers', ['delivery_task_id' => $rejected, 'status' => 'rejected', 'rejection_reason' => $input['reason']]);
        $this->assertDatabaseHas('dispatch_schedule_shipments', ['dispatch_schedule_id' => $schedule['id'], 'delivery_task_id' => $rejected]);
        $this->actingAs($courier)->getJson('/api/v1/courier/final-mile-batches/'.$schedule['id'])->assertOk()->assertJsonCount(2, 'data.tasks');
        $this->getJson('/api/v1/courier/final-mile-batches/'.$newSchedule['id'])->assertOk()->assertJsonPath('data.tasks.0.task_id', $rejected);
        $this->postJson("/api/v1/courier/final-mile-tasks/{$rejected}/accept")->assertOk();
        $this->assertDatabaseHas('delivery_tasks', ['id' => $accepted, 'status' => 'delivery_accepted', 'revision' => $revision]);
        $this->assertDatabaseHas('delivery_tasks', ['id' => $untouched, 'status' => 'delivery_assigned']);
        $this->expectException(\LogicException::class);
        $migration->down();
    }

    public function test_rejected_parcel_retains_staging_and_rescheduling_rechecks_lane_revision(): void
    {
        config(['hub-routing.enabled' => false]);
        [$logistics, $courier, $references] = $this->receivedParcels(1);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'RETRY-01', 'name' => 'Delivery staging', 'type' => 'standard'])->assertCreated()->json('data');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => $lane['id'], 'reference' => $references[0],
            'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$references[0])->assertOk()->json('data');
        $input = ['shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(), 'assignments' => [$this->dispatchAssignment($record)]];
        $schedule = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', $input)->assertCreated()->json('data');
        $shipment = Shipment::findOrFail($record['shipment_id']);
        $assignment = $shipment->sorting_assignment;
        $task = $this->actingAs($courier)->getJson('/api/v1/courier/final-mile-tasks')->assertOk()->json('data.0');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/final-mile-tasks/'.$task['task_id'].'/reject', ['reason' => 'Cannot take this parcel'])->assertOk();
        $this->assertSame($assignment, $shipment->fresh()->sorting_assignment);
        $this->assertSame($lane['id'], $shipment->fresh()->sorting_lane_id);
        $this->assertSame($session['id'], $shipment->fresh()->sorting_session_id);
        $this->getJson('/api/v1/courier/final-mile-batches/'.$schedule['id'])->assertNotFound();
        $this->actingAs($logistics)->getJson('/api/v1/logistics/dashboard/queue?status=sorted_at_hub&lane_id='.$lane['id'])->assertOk()->assertJsonFragment(['shipment_id' => $shipment->id]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', $input)->assertConflict()->assertJsonPath('code', 'DISPATCH_ASSIGNMENT_CONFLICT');
        $fresh = $this->getJson('/api/v1/logistics/update-status/records/'.$references[0])->assertOk()->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [...$input, 'assignments' => [$this->dispatchAssignment($fresh)]])->assertCreated()->assertJsonPath('data.parcels.0.source_lane.code', 'RETRY-01');
        $this->assertDatabaseCount('dispatch_schedule_shipments', 2);
        $this->assertDatabaseHas('dispatch_schedule_shipments', ['dispatch_schedule_id' => $schedule['id'], 'delivery_task_id' => $task['task_id']]);
    }
}
