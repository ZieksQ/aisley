<?php

namespace Tests\Feature\Courier;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\PickupScheduleStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PickupSchedule;
use App\Models\User;
use App\Services\Courier\CourierNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;
use Tests\TestCase;

class CourierNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_inbox_requires_an_active_approved_courier_affiliation(): void
    {
        $this->getJson('/api/v1/courier/notifications')->assertUnauthorized();

        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/courier/notifications')->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');

        [$pending] = $this->courier('pending@example.com', UserStatus::Pending);
        $this->actingAs($pending)->getJson('/api/v1/courier/notifications')->assertForbidden()->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        [$revoked] = $this->courier('revoked@example.com');
        $revoked->courierLogisticsAffiliation()->update(['status' => CourierAffiliationStatus::Revoked]);
        $this->actingAs($revoked)->getJson('/api/v1/courier/notifications')->assertForbidden()->assertJsonPath('code', 'LOGISTICS_ASSOCIATION_INVALID');
    }

    public function test_list_count_detail_and_mark_read_are_courier_scoped(): void
    {
        [$courier, , $organization, $hub] = $this->courier('inbox@example.com');
        [$foreign] = $this->courier('foreign-inbox@example.com');
        $schedule = $this->schedule($courier, $organization->id, $hub->id);
        $own = $this->notification($courier, 'pickup-schedule.assigned', [
            'schedule_id' => $schedule->id,
            'raw_secret' => 'should never be returned',
        ]);
        $read = $this->notification($courier, 'pickup-schedule.revised', ['schedule_id' => $schedule->id]);
        $read->update(['read_at' => now()->subSecond()]);
        $foreignSchedule = $this->schedule($foreign, $foreign->courierLogisticsAffiliation->logistics_organization_id, $foreign->courierLogisticsAffiliation->logistics_hub_id);
        $foreignNotification = $this->notification($foreign, 'pickup-schedule.assigned', ['schedule_id' => $foreignSchedule->id]);
        $this->notification($courier, 'unsupported.type', ['schedule_id' => $schedule->id]);

        $response = $this->actingAs($courier)->getJson('/api/v1/courier/notifications?status=unread&limit=20');

        $response
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', (string) $own->id)
            ->assertJsonPath('data.0.type', 'pickup-schedule.assigned')
            ->assertJsonPath('data.0.title', 'Pickup scheduled')
            ->assertJsonPath('data.0.resource_type', 'pickup_schedule')
            ->assertJsonPath('data.0.resource_id', (string) $schedule->id)
            ->assertJsonPath('data.0.destination', '/pickup-schedules/'.(string) $schedule->id)
            ->assertJsonMissing(['raw_secret' => 'should never be returned'])
            ->assertJsonPath('meta.next_cursor', null);

        $this->actingAs($courier)->getJson('/api/v1/courier/notifications/unread-count')
            ->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->actingAs($courier)->getJson("/api/v1/courier/notifications/{$foreignNotification->id}")->assertNotFound();
        $this->actingAs($courier)->getJson("/api/v1/courier/notifications/{$own->id}")
            ->assertOk()->assertJsonPath('data.read_at', null);
        $this->actingAs($courier)->postJson("/api/v1/courier/notifications/{$own->id}/read")
            ->assertOk()->assertJsonPath('data.read_at', fn ($value): bool => is_string($value));
        $firstReadAt = $courier->notifications()->whereKey($own->id)->value('read_at');
        $this->actingAs($courier)->postJson("/api/v1/courier/notifications/{$own->id}/read")->assertOk();
        $this->assertEquals($firstReadAt, $courier->notifications()->whereKey($own->id)->value('read_at'));
        $this->actingAs($courier)->getJson('/api/v1/courier/notifications/unread-count')->assertJsonPath('data.unread_count', 0);
    }

    public function test_cursor_is_bounded_signed_and_filter_scoped(): void
    {
        [$courier, , $organization, $hub] = $this->courier('cursor@example.com');
        foreach (range(1, 3) as $index) {
            $schedule = $this->schedule($courier, $organization->id, $hub->id, 'PUS-CURSOR-'.$index);
            $notification = $this->notification($courier, 'pickup-schedule.assigned', ['schedule_id' => $schedule->id]);
            $notification->update(['created_at' => now()->subMinutes($index), 'updated_at' => now()->subMinutes($index)]);
        }

        $first = $this->actingAs($courier)->getJson('/api/v1/courier/notifications?limit=2')->assertOk();
        $cursor = $first->json('meta.next_cursor');
        $this->assertIsString($cursor);
        $this->assertCount(2, $first->json('data'));
        $this->actingAs($courier)->getJson('/api/v1/courier/notifications?limit=2&cursor='.urlencode($cursor))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.next_cursor', null);
        $this->actingAs($courier)->getJson('/api/v1/courier/notifications?status=read&cursor='.urlencode($cursor))
            ->assertUnprocessable()->assertJsonValidationErrors('cursor');
        $this->actingAs($courier)->getJson('/api/v1/courier/notifications?cursor=not-a-cursor')
            ->assertUnprocessable()->assertJsonValidationErrors('cursor');
        $this->actingAs($courier)->getJson('/api/v1/courier/notifications?per_page=50')
            ->assertUnprocessable()->assertJsonValidationErrors('per_page');
    }

    public function test_legacy_or_no_longer_actionable_sources_are_redacted_and_producers_deduplicate(): void
    {
        [$courier, , $organization, $hub] = $this->courier('redacted@example.com');
        $schedule = $this->schedule($courier, $organization->id, $hub->id, 'PUS-CANCELLED', PickupScheduleStatus::Cancelled);
        $cancelled = $this->notification($courier, 'pickup-schedule.cancelled', ['schedule_id' => $schedule->id]);
        $malformed = $this->notification($courier, 'pickup-schedule.assigned', ['schedule_id' => 'not-a-uuid', 'summary' => 'private address']);
        $this->notification($courier, 'courier-task.final-mile-offered', ['offer_id' => 'not-a-uuid']);

        $this->actingAs($courier)->getJson("/api/v1/courier/notifications/{$cancelled->id}")
            ->assertOk()->assertJsonPath('data.resource_id', $schedule->id)->assertJsonPath('data.destination', null);
        $this->actingAs($courier)->getJson("/api/v1/courier/notifications/{$malformed->id}")
            ->assertOk()->assertJsonPath('data.title', 'Notification')->assertJsonPath('data.destination', null)
            ->assertJsonMissing(['summary' => 'private address']);

        app(CourierNotificationService::class)->queuePickupSchedule($schedule, 'assigned');
        app(CourierNotificationService::class)->queuePickupSchedule($schedule, 'assigned');
        $this->assertSame(1, $courier->notifications()->where('type', 'pickup-schedule.assigned')->get()
            ->filter(fn (DatabaseNotification $notification): bool => ($notification->data['schedule_id'] ?? null) === $schedule->id)
            ->count());
    }

    /** @return array{0: User, 1: User, 2: object, 3: object} */
    private function courier(string $email, UserStatus $status = UserStatus::Active): array
    {
        $logistics = User::factory()->create(['email' => 'logistics-'.$email, 'role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $logistics->addresses()->create([
            'type' => AddressType::Both,
            'label' => 'Hub',
            'recipient_name' => 'Logistics Operator',
            'contact_number' => '09171234567',
            'address_line_1' => '1 Hub Road',
            'barangay' => 'Poblacion',
            'city_municipality' => 'Manila',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1000',
            'country' => 'Philippines',
            'is_default' => true,
        ]);
        $organization = $logistics->logisticsOrganization()->create(['business_name' => 'Logistics '.$email]);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Hub']);
        $courier = User::factory()->create(['email' => $email, 'role' => UserRole::Courier, 'status' => $status]);
        $courier->courierProfile()->create(['first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09171234568', 'sex' => 'female', 'birth_date' => '1994-06-15']);
        $courier->courierLogisticsAffiliation()->create(['logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id, 'status' => CourierAffiliationStatus::Approved]);

        return [$courier->fresh(), $logistics, $organization, $hub];
    }

    private function schedule(User $courier, string $organizationId, string $hubId, ?string $reference = null, PickupScheduleStatus $status = PickupScheduleStatus::Scheduled): PickupSchedule
    {
        return PickupSchedule::create([
            'logistics_organization_id' => $organizationId,
            'logistics_hub_id' => $hubId,
            'courier_id' => $courier->id,
            'reference' => $reference ?? 'PUS-'.strtoupper(Str::random(10)),
            'status' => $status,
            'starts_at' => now()->addHours(3),
            'ends_at' => now()->addHours(4),
            'revision' => 1,
            'idempotency_key' => (string) Str::uuid(),
        ]);
    }

    /** @param array<string, mixed> $data */
    private function notification(User $courier, string $type, array $data): DatabaseNotification
    {
        return $courier->notifications()->create(['id' => (string) Str::uuid(), 'type' => $type, 'data' => $data]);
    }
}
