<?php

namespace Tests\Feature\Logistics;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CompanyTruck;
use App\Models\LinehaulTrip;
use App\Models\PlatformPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class FleetMonitoringTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    private const URL = '/api/v1/logistics/fleet/monitoring';

    public function test_reads_are_scoped_and_require_an_active_logistics_account(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $truck = $this->truck($a);
        $foreign = $this->truck($b, ['plate_number' => 'FOREIGN']);
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]))
            ->getJson(self::URL)->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
        $a[0]->update(['status' => UserStatus::Suspended]);
        $this->actingAs($a[0])->getJson(self::URL)->assertForbidden()->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
        $a[0]->update(['status' => UserStatus::Active]);
        $this->actingAs($a[0])->getJson(self::URL)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $truck->id)
            ->assertHeader('Cache-Control', 'no-store, private');
        foreach ([$foreign->id, (string) Str::uuid()] as $id) {
            $this->getJson(self::URL.'/'.$id)->assertNotFound();
            $this->getJson(self::URL.'/'.$id.'/trips')->assertNotFound();
        }
        $this->getJson(self::URL.'?search=FOREIGN')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_old_active_assignment_is_independent_of_paginated_history(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $truck = $this->truck($a, ['availability' => 'in_transit']);
        $trip = $this->trip($a, $b, $truck, ['status' => 'in_transfer', 'created_at' => now()->subDays(50), 'departed_at' => now()->subHour()]);
        for ($index = 0; $index < 25; $index++) {
            $this->trip($a, $b, $truck, ['status' => $index % 2 ? 'rejected' : 'cancelled']);
        }
        $this->actingAs($a[0])->getJson(self::URL)->assertOk()->assertJsonPath('data.0.active_trip.id', $trip->id)
            ->assertJsonPath('data.0.reserved_or_onboard_parcels', 12)->assertJsonPath('data.0.remaining_capacity', 88)
            ->assertJsonPath('data.0.last_confirmed_hub.id', $a[2]->id);
        $this->getJson(self::URL.'/'.$truck->id.'/trips?per_page=10&page=3')->assertOk()
            ->assertJsonCount(6, 'data')->assertJsonPath('meta.total', 26)->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('data.5.id', $trip->id);
        $this->getJson(self::URL.'/'.$truck->id)->assertOk()->assertJsonPath('data.active_trip.id', $trip->id);
    }

    public function test_filters_summary_time_boundaries_and_search(): void
    {
        $this->travelTo(now()->startOfSecond());
        $a = $this->logistics();
        $b = $this->logistics();
        $b[2]->update(['name' => 'Davao destination']);
        $due = $this->truck($a, ['plate_number' => 'AAA', 'availability' => 'reserved']);
        $pending = $this->trip($a, $b, $due, ['scheduled_for' => now()->subSecond()]);
        $at = $this->truck($a, ['plate_number' => 'BBB', 'availability' => 'reserved']);
        $this->trip($a, $b, $at, ['status' => 'scheduled', 'scheduled_for' => now()]);
        $this->truck($a, ['plate_number' => 'CCC', 'is_active' => false, 'availability' => 'inactive']);
        $this->truck($b, ['plate_number' => 'ZZZ']);
        $this->actingAs($a[0])->getJson(self::URL.'?overdue=1&availability=reserved')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $due->id)->assertJsonPath('data.0.active_trip.overdue', true)
            ->assertJsonPath('meta.summary.reserved', 2)->assertJsonPath('meta.summary.inactive', 1)->assertJsonPath('meta.summary.available', 0);
        foreach (['aaa', 'isuzu', 'davao', 'cora rider'] as $search) {
            $this->getJson(self::URL.'?search='.urlencode($search))->assertOk()->assertJsonPath('data.0.id', $due->id);
        }
        $this->getJson(self::URL.'?search=%25')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::URL.'?per_page=1&page=2')->assertOk()->assertJsonPath('data.0.id', $at->id)->assertJsonPath('meta.total', 3);
        $this->getJson(self::URL.'/'.$at->id)->assertOk()->assertJsonPath('data.active_trip.overdue', false);
        $this->travel(1)->seconds();
        $this->getJson(self::URL.'?overdue=1')->assertOk()->assertJsonCount(2, 'data');
        $pending->update(['status' => 'in_transfer', 'departed_at' => now()]);
        $this->getJson(self::URL.'?overdue=1')->assertOk()->assertJsonCount(1, 'data');
        foreach (['availability=broken', 'overdue=yes', 'page=0', 'per_page=101', 'search='.str_repeat('a', 101)] as $query) {
            $this->getJson(self::URL.'?'.$query)->assertUnprocessable();
        }
    }

    public function test_empty_return_and_reported_arrival_are_truthful_without_mutation(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $truck = $this->truck($a, ['availability' => 'in_transit', 'last_confirmed_hub_id' => $b[2]->id]);
        $trip = $this->trip($a, $b, $truck, [
            'direction' => 'return', 'status' => 'in_transfer', 'from_hub_id' => $b[2]->id, 'to_hub_id' => $a[2]->id,
            'requested_by' => $b[0]->id, 'parcel_count' => 0, 'departed_at' => now()->subHour(), 'courier_arrived_at' => now(),
        ]);
        $before = $trip->fresh()->getAttributes();
        $response = $this->actingAs($a[0])->getJson(self::URL.'/'.$truck->id)->assertOk()
            ->assertJsonPath('data.active_trip.direction', 'return')->assertJsonPath('data.active_trip.parcel_count', 0)
            ->assertJsonPath('data.active_trip.arrived_at', null)->assertJsonPath('data.active_trip.unloading_closed_at', null)
            ->assertJsonPath('data.last_confirmed_hub.id', $b[2]->id)->assertJsonPath('data.remaining_capacity', 100);
        $this->assertNotNull($response->json('data.active_trip.courier_arrived_at'));
        $this->assertArrayNotHasKey('email', $response->json('data.active_trip.driver'));
        $this->assertSame($before, $trip->fresh()->getAttributes());
        $this->getJson(self::URL.'/'.$truck->id.'/trips')->assertOk()->assertJsonPath('data.0.id', $trip->id);
        $this->actingAs($b[0])->getJson(self::URL.'/'.$truck->id)->assertNotFound();
    }

    public function test_idle_fleet_and_empty_history_have_explicit_zero_data(): void
    {
        $a = $this->logistics();
        $this->actingAs($a[0])->getJson(self::URL)->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.summary.available', 0);
        $truck = $this->truck($a, ['last_confirmed_hub_id' => null]);
        $this->getJson(self::URL.'/'.$truck->id)->assertOk()->assertJsonPath('data.active_trip', null)
            ->assertJsonPath('data.last_confirmed_hub', null)->assertJsonPath('data.reserved_or_onboard_parcels', 0);
        $this->getJson(self::URL.'/'.$truck->id.'/trips')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
    }

    public function test_policy_consent_gates_every_monitoring_read(): void
    {
        $a = $this->logistics();
        $truck = $this->truck($a);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $policy = PlatformPolicy::create(['type' => PlatformPolicyType::TermsOfService]);
        $version = $policy->versions()->create([
            'version' => 1, 'title' => 'Terms of Service', 'content' => 'Test shared terms',
            'status' => PlatformPolicyVersionStatus::Published, 'requires_reconsent' => true,
            'revision' => 1, 'created_by_admin_id' => $admin->id, 'published_by_admin_id' => $admin->id, 'published_at' => now(),
        ]);
        $policy->update(['current_version_id' => $version->id]);
        $this->actingAs($a[0]);
        foreach ([self::URL, self::URL.'/assignments', self::URL.'/'.$truck->id, self::URL.'/'.$truck->id.'/trips', self::URL.'/'.$truck->id.'/trips/'.Str::uuid()] as $url) {
            $this->getJson($url)->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
        }
    }

    public function test_completed_event_timestamps_and_historical_states_are_preserved(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $truck = $this->truck($a, ['availability' => 'visiting', 'last_confirmed_hub_id' => $b[2]->id]);
        $trip = $this->trip($a, $b, $truck, [
            'status' => 'received', 'decided_at' => now()->subHours(5), 'released_for_departure_at' => now()->subHours(4),
            'departed_at' => now()->subHours(3), 'courier_arrived_at' => now()->subHours(2),
            'arrived_at' => now()->subHour(), 'unloading_closed_at' => now(), 'received_at' => now(),
        ])->fresh();
        $history = $this->actingAs($a[0])->getJson(self::URL.'/'.$truck->id.'/trips')->assertOk()
            ->assertJsonPath('data.0.status', 'received')->assertJsonPath('data.0.overdue', false);
        foreach (['decided_at', 'released_for_departure_at', 'departed_at', 'courier_arrived_at', 'arrived_at', 'unloading_closed_at'] as $field) {
            $this->assertSame($trip->$field->toISOString(), $history->json('data.0.'.$field));
        }
        $this->getJson(self::URL.'/'.$truck->id)->assertOk()->assertJsonPath('data.active_trip', null)
            ->assertJsonPath('data.availability', 'visiting');
    }

    public function test_past_transfer_details_are_scoped_to_the_owned_truck_and_terminal_trips(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $truck = $this->truck($a);
        $otherTruck = $this->truck($a);
        $a[2]->address->update(['latitude' => 14.5, 'longitude' => 121.1]);
        $b[2]->address->update(['latitude' => 91, 'longitude' => 121.2]);
        $past = $this->trip($a, $b, $truck, ['status' => 'received']);
        $active = $this->trip($a, $b, $truck);
        $other = $this->trip($a, $b, $otherTruck, ['status' => 'cancelled']);
        $this->actingAs($a[0])->getJson(self::URL.'/'.$truck->id.'/trips?past=1')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $past->id);
        $this->getJson(self::URL.'/'.$truck->id.'/trips/'.$past->id)->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.from_hub.logistics.id', $a[1]->id)
            ->assertJsonPath('data.to_hub.logistics.id', $b[1]->id)
            ->assertJsonPath('data.manifest_id', null)
            ->assertJsonPath('data.from_hub.latitude', 14.5)
            ->assertJsonPath('data.from_hub.longitude', 121.1)
            ->assertJsonPath('data.to_hub.latitude', null)
            ->assertJsonPath('data.to_hub.longitude', null)
            ->assertJsonMissingPath('data.from_hub.address');
        foreach ([$active->id, $other->id, (string) Str::uuid()] as $id) {
            $this->getJson(self::URL.'/'.$truck->id.'/trips/'.$id)->assertNotFound();
        }
        $this->getJson(self::URL.'/'.$truck->id.'/trips?past=invalid')->assertUnprocessable();
        $this->actingAs($b[0])->getJson(self::URL.'/'.$truck->id.'/trips/'.$past->id)->assertNotFound();
        $this->actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]))
            ->getJson(self::URL.'/'.$truck->id.'/trips/'.$past->id)->assertForbidden();
    }

    private function truck(array $context, array $overrides = []): CompanyTruck
    {
        return CompanyTruck::create([
            'logistics_organization_id' => $context[1]->id, 'home_hub_id' => $context[2]->id,
            'last_confirmed_hub_id' => $context[2]->id, 'plate_number' => 'TRK-'.Str::random(8),
            'make' => 'Isuzu', 'max_parcels' => 100, ...$overrides,
        ]);
    }

    private function trip(array $from, array $to, CompanyTruck $truck, array $overrides = []): LinehaulTrip
    {
        $driver = $this->courier($from[1]->id, $from[2]->id);

        $trip = LinehaulTrip::create([
            'owner_logistics_organization_id' => $from[1]->id, 'home_hub_id' => $from[2]->id,
            'from_hub_id' => $from[2]->id, 'to_hub_id' => $to[2]->id, 'company_truck_id' => $truck->id,
            'driver_id' => $driver->id, 'requested_by' => $from[0]->id, 'direction' => 'outbound',
            'status' => 'pending_acceptance', 'scheduled_for' => now()->addHour(), 'capacity_snapshot' => 100,
            'parcel_count' => 12, 'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('a', 64), ...$overrides,
        ]);
        if (isset($overrides['created_at'])) {
            $trip->forceFill(['created_at' => $overrides['created_at']])->save();
        }

        return $trip;
    }
}
