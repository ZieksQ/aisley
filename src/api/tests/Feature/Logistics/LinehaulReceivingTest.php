<?php

namespace Tests\Feature\Logistics;

use App\Models\LinehaulTrip;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\LinehaulReceivingFixtures;
use Tests\TestCase;

class LinehaulReceivingTest extends TestCase
{
    use LinehaulReceivingFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.geoapify.server_key' => 'test-key']);
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
    }

    public function test_partial_receipts_holds_shortages_and_late_receipt_after_return(): void
    {
        [$a, $b, $trip, $references, $truck, $driver] = $this->receivingLoad();
        $base = '/api/v1/logistics/linehaul/trips/'.$trip['id'].'/receiving';
        $this->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/receive', ['expected_revision' => 3])->assertConflict()->assertJsonPath('code', 'LINEHAUL_SCAN_REQUIRED');
        $this->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonPath('data.manifests.0.can_receive', false);
        $manifestId = LinehaulTrip::findOrFail($trip['id'])->linehaul_manifest_id;
        $this->postJson('/api/v1/logistics/linehaul/manifests/'.$manifestId.'/receive')->assertConflict()->assertJsonPath('code', 'LINEHAUL_SCAN_REQUIRED');
        $foreign = $this->pinnedHub();
        $this->actingAs($foreign[0])->getJson($base)->assertNotFound();
        $this->postJson($base.'/start', ['client_id' => (string) Str::uuid()])->assertNotFound();
        $this->actingAs($b[0])->postJson($base.'/start', ['client_id' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.counts.received', 0);
        $this->assertSame('unloading', $truck->fresh()->availability->value);
        $this->assertSame(3, Shipment::where('status', 'in_transfer')->count());
        $this->actingAs($a[0])->patchJson('/api/v1/logistics/fleet/drivers/'.$driver->id, ['can_drive_company_truck' => false, 'expected_revision' => 1])->assertConflict();
        $this->actingAs($b[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/return', [
            'scheduled_for' => now()->addHour()->toISOString(), 'empty_return' => true,
        ])->assertConflict();
        $good = $this->captureInput($references[0]);
        $damaged = $this->captureInput($references[1], 'damaged');
        $unexpected = $this->captureInput('UNEXPECTED-TRACKING');
        $result = $this->postJson($base.'/batches', ['captures' => [$good, $damaged, $unexpected]])->assertOk()
            ->assertJsonPath('data.receiving.counts.received', 2)->assertJsonPath('data.receiving.counts.outstanding', 1)
            ->assertJsonPath('data.results.2.status', 'unexpected')->assertJsonMissingPath('data.results.2.shipment_id')->json('data');
        $receipt = $result['results'][0];
        $this->postJson($base.'/batches', ['captures' => [[...$good, 'condition' => 'damaged', 'reason' => 'Changed']]])->assertOk()->assertJsonPath('data.results.0.code', 'IDEMPOTENCY_KEY_REUSED');
        $this->assertSame(2, ShipmentEvent::where('event_type', 'hub_transfer_received')->count());
        $this->sortFor($b, $references[0], null);
        $session = $this->getJson('/api/v1/logistics/sorting')->assertOk()->json('data.session');
        $this->assertCount(1, $session['items']);
        $this->assertSame('receiving', LinehaulTrip::find($trip['id'])->status->value);
        $this->postJson($base.'/batches', ['captures' => [$good]])->assertOk()->assertJsonPath('data.results.0.receipt_id', $receipt['receipt_id']);
        $this->postJson($base.'/batches', ['captures' => [$this->captureInput($references[0])]])->assertOk()->assertJsonPath('data.results.0.receipt_id', $receipt['receipt_id']);
        $this->postJson($base.'/finish', ['client_id' => (string) Str::uuid()])->assertUnprocessable();
        $finish = ['client_id' => (string) Str::uuid(), 'acknowledge_shortages' => true, 'reason' => 'One parcel absent after unloading and dock search.'];
        $closed = $this->postJson($base.'/finish', $finish)->assertOk()->assertJsonPath('data.outcome', 'discrepancies')->json('data');
        $this->postJson($base.'/finish', $finish)->assertOk();
        $this->assertSame('visiting', $truck->fresh()->availability->value);
        $this->assertSame(1, Shipment::where('status', 'in_transfer')->count());
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $a[0]->id, 'type' => 'logistics-linehaul.receiving-discrepancies']);
        $damage = collect($closed['discrepancies'])->firstWhere('kind', 'damaged');
        $missing = collect($closed['discrepancies'])->firstWhere('kind', 'missing');
        $this->postJson($base.'/discrepancies/'.$missing['id'].'/resolve', ['client_id' => (string) Str::uuid(), 'reason' => 'Ignore shortage'])->assertConflict();
        $this->postJson($base.'/discrepancies/'.$damage['id'].'/resolve', ['client_id' => (string) Str::uuid()])->assertUnprocessable();
        $this->postJson($base.'/discrepancies/'.$damage['id'].'/resolve', ['client_id' => (string) Str::uuid(), 'reason' => 'Inspected and repacked; contents intact.'])->assertOk();
        $this->assertSame(0, Shipment::where('condition_hold', true)->count());
        $this->assertCount(1, $this->getJson('/api/v1/logistics/sorting')->json('data.session.items'));
        $return = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/return', [
            'scheduled_for' => now()->addHour()->toISOString(), 'empty_return' => true,
        ])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/linehaul/trips/'.$return['id'].'/depart', ['expected_revision' => 1])->assertOk();
        $this->actingAs($a[0])->postJson('/api/v1/logistics/linehaul/trips/'.$return['id'].'/receiving/start', ['client_id' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.status', 'received');
        $this->actingAs($b[0])->postJson($base.'/batches', ['captures' => [$this->captureInput($references[2])]])->assertOk()->assertJsonPath('data.receiving.counts.outstanding', 0)->assertJsonPath('data.receiving.closed_at', $closed['closed_at']);
        $this->assertNotNull(DB::table('linehaul_discrepancies')->where('id', $missing['id'])->value('resolved_at'));
        $this->assertSame('available', $truck->fresh()->availability->value);
        $this->assertDatabaseCount('linehaul_receipts', 3);
        $this->assertSame(3, ShipmentEvent::where('event_type', 'hub_transfer_received')->count());
    }

    public function test_bad_member_does_not_roll_back_valid_receipt_and_standalone_manifest_still_receives(): void
    {
        [$a, $b, $trip, $references] = $this->receivingLoad(2);
        $base = '/api/v1/logistics/linehaul/trips/'.$trip['id'].'/receiving';
        $this->postJson($base.'/start', ['client_id' => (string) Str::uuid()])->assertOk();
        $member = LinehaulTrip::findOrFail($trip['id'])->shipments()->whereHas('shipment.parcel.waybill', fn ($q) => $q->where('reference', $references[1]))->firstOrFail();
        DB::table('shipment_route_hops')->where('id', $member->shipment_route_hop_id)->update(['status' => 'pending']);
        $this->postJson($base.'/batches', ['captures' => [$this->captureInput($references[0]), $this->captureInput($references[1])]])->assertOk()
            ->assertJsonPath('data.results.0.status', 'received')->assertJsonPath('data.results.1.status', 'failed')->assertJsonPath('data.receiving.counts.received', 1);
        $this->assertDatabaseCount('linehaul_receipts', 1);
        DB::table('shipment_route_hops')->where('id', $member->shipment_route_hop_id)->update(['status' => 'in_transfer']);
        // Detach the still-in-transit member into a historical standalone manifest.
        $manifest = DB::table('linehaul_manifests')->where('id', LinehaulTrip::findOrFail($trip['id'])->linehaul_manifest_id)->first();
        $legacyId = (string) Str::uuid();
        DB::table('linehaul_manifests')->insert([...((array) $manifest), 'id' => $legacyId,
            'items' => json_encode([collect(json_decode($manifest->items, true))->firstWhere('reference', $references[1])])]);
        DB::table('shipment_route_hops')->where('id', $member->shipment_route_hop_id)->update(['linehaul_manifest_id' => $legacyId]);
        $this->postJson('/api/v1/logistics/linehaul/manifests/'.$legacyId.'/receive')->assertOk()->assertJsonPath('data.status', 'received');
        $this->assertDatabaseCount('linehaul_receipts', 1);
    }

    public function test_cargo_return_requires_individual_receipts_before_home_availability(): void
    {
        [$a, $b, $trip, $references, $truck] = $this->receivingLoad(1);
        $this->receiveTripParcels($trip['id']);
        DB::table('hub_service_areas')->where('logistics_hub_id', $b[2]->id)->update(['is_active' => false]);
        $this->area($a[2]);
        [, $returnReference] = $this->pickupAt($b);
        $this->receiveOrigin($b, $returnReference);
        $this->sortFor($b, $returnReference, $a[2]->id);
        $return = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/return', [
            'scheduled_for' => now()->addHour()->toISOString(), 'empty_return' => false,
        ])->assertCreated()->assertJsonPath('data.parcel_count', 1)->json('data');
        $this->postJson('/api/v1/logistics/linehaul/trips/'.$return['id'].'/depart', ['expected_revision' => 1])->assertOk();
        $this->actingAs($a[0])->postJson('/api/v1/logistics/linehaul/trips/'.$return['id'].'/receive', ['expected_revision' => 2])->assertConflict();
        $this->receiveTripParcels($return['id']);
        $this->assertSame('available', $truck->fresh()->availability->value);
        $this->assertSame($a[2]->id, $truck->fresh()->last_confirmed_hub_id);
    }

    public function test_clean_receipt_and_historical_manifest_compatibility(): void
    {
        [$a, $b, $trip] = $this->receivingLoad(1);
        $this->receiveTripParcels($trip['id']);
        $this->assertDatabaseHas('linehaul_trips', ['id' => $trip['id'], 'unloading_outcome' => 'clean']);
        $this->assertDatabaseCount('linehaul_discrepancies', 0);
        $this->assertDatabaseMissing('notifications', ['type' => 'logistics-linehaul.receiving-discrepancies']);
        // Historical completed receipts retain completion without manufacturing scan evidence.
        DB::table('linehaul_trips')->where('id', $trip['id'])->update(['arrived_at' => null]);
        $this->getJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/receiving')->assertOk()->assertJsonPath('data.historical_receipt', true);
    }
}
