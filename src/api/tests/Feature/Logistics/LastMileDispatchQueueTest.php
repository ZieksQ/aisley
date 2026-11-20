<?php

namespace Tests\Feature\Logistics;

use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use App\Models\ShipmentRoute;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class LastMileDispatchQueueTest extends TestCase
{
    use LocalSortingFixtures;
    use RefreshDatabase;

    public function test_last_mile_filter_excludes_transfers_before_pagination_and_summary_counts(): void
    {
        config(['hub-routing.enabled' => false]);
        [$logistics] = $this->receivedParcels(9);
        [, , $otherHub] = $this->logistics();
        $shipments = Shipment::with('parcel')->orderBy('id')->get();
        $eligible = [];
        foreach (['legacy', 'local', 'completed', 'planned', 'unresolved', 'unavailable', 'wrong_hub', 'held', 'received'] as $index => $state) {
            $shipment = $shipments[$index];
            $shipment->update([
                'status' => $state === 'received' ? ShipmentStatus::ReceivedAtHub : ShipmentStatus::SortedAtHub,
                'condition_hold' => $state === 'held',
            ]);
            if ($state !== 'legacy') {
                ShipmentRoute::create([
                    'waybill_id' => $shipment->parcel->waybill_id,
                    'shipment_id' => $shipment->id,
                    'origin_hub_id' => $shipment->current_hub_id,
                    'destination_hub_id' => $state === 'wrong_hub' ? $otherHub->id : $shipment->current_hub_id,
                    'status' => in_array($state, ['wrong_hub', 'held', 'received']) ? 'completed' : $state,
                    'algorithm' => 'test', 'objective' => 'test',
                ]);
            }
            if (in_array($state, ['legacy', 'local', 'completed'])) {
                $eligible[] = $shipment->id;
            }
        }

        $base = '/api/v1/logistics/dashboard/queue?status=sorted_at_hub';
        $this->actingAs($logistics)->getJson($base)->assertOk()->assertJsonPath('meta.total', 8);
        $this->getJson($base.'&final_mile=0')->assertOk()->assertJsonPath('meta.total', 8);
        $filtered = $this->getJson($base.'&final_mile=1')->assertOk()
            ->assertJsonPath('meta.total', 3)->assertJsonPath('summary.total', 3)
            ->assertJsonPath('summary.by_status.sorted_at_hub', 3)
            ->assertJsonPath('summary.by_lane.0.count', 3)->json('data');
        $this->assertEqualsCanonicalizing($eligible, array_column($filtered, 'shipment_id'));
        $this->getJson($base.'&final_mile=1&per_page=1')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 3);
        $this->getJson($base.'&final_mile=1&lane_id=unassigned')->assertOk()->assertJsonPath('meta.total', 3);
        // A transferred parcel becomes visible only after destination custody and route completion.
        $transfer = $shipments[3];
        $transfer->update(['current_hub_id' => $otherHub->id, 'current_logistics_organization_id' => $otherHub->logistics_organization_id]);
        $transfer->route()->update(['destination_hub_id' => $otherHub->id, 'status' => 'completed']);
        $destination = $otherHub->organization->user;
        $this->actingAs($destination)->getJson($base.'&final_mile=1')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.shipment_id', $transfer->id);
        $this->actingAs($logistics);
        $this->getJson($base.'&final_mile=invalid')->assertUnprocessable()->assertJsonValidationErrors('final_mile');
        [$foreign] = $this->logistics();
        $this->actingAs($foreign)->getJson($base.'&final_mile=1')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
    }
}
