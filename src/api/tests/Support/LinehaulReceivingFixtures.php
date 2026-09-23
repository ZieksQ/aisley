<?php

namespace Tests\Support;

use App\Models\CompanyTruck;
use App\Models\Shipment;
use Illuminate\Support\Str;

trait LinehaulReceivingFixtures
{
    use HubRoutingFixtures;

    /** A repeatable three-parcel load: good, damaged, and initially missing. */
    private function receivingLoad(int $count = 3): array
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($b[2], $a[2]);
        $this->area($b[2]);
        $references = [];
        for ($i = 0; $i < $count; $i++) {
            [, $references[]] = $this->pickupAt($a);
            $this->receiveOrigin($a, $references[$i]);
        }
        $this->sortFor($a, $references[0], $b[2]->id);
        $session = $this->getJson('/api/v1/logistics/sorting')->assertOk()->json('data.session');
        foreach (array_slice($references, 1) as $reference) {
            $item = collect($session['items'])->firstWhere('reference', $reference);
            $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [[
                'client_id' => (string) Str::uuid(), 'auto_route' => true, 'reference' => $reference,
                'expected_revision' => $item['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(),
            ]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        }
        $driver = $this->courier($a[1]->id, $a[2]->id);
        $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => true]);
        $truck = CompanyTruck::create(['logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id,
            'last_confirmed_hub_id' => $a[2]->id, 'plate_number' => 'RECEIVE-001', 'max_parcels' => $count]);
        $trip = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', [
            'next_hub_id' => $b[2]->id, 'company_truck_id' => $truck->id, 'driver_id' => $driver->id,
            'scheduled_for' => now()->addHour()->toISOString(),
            'shipment_ids' => Shipment::where('current_hub_id', $a[2]->id)->pluck('id')->all(),
        ])->assertCreated()->json('data');
        $this->actingAs($b[0])->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/decision', ['accept' => true, 'expected_revision' => 1])->assertOk();
        $this->actingAs($a[0])->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/depart', ['expected_revision' => 2])->assertOk();
        $this->actingAs($b[0]);

        return [$a, $b, $trip, $references, $truck, $driver];
    }

    private function captureInput(string $reference, string $condition = 'good'): array
    {
        return ['client_id' => (string) Str::uuid(), 'reference' => $reference, 'condition' => $condition,
            'source' => 'manual', 'captured_at' => now()->toISOString(), 'reason' => $condition === 'damaged' ? 'Crushed packaging; inspect contents.' : null];
    }
}
