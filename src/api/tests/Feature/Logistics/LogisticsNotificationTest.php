<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Services\Logistics\LogisticsNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class LogisticsNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_inbox_requires_an_active_logistics_account_and_hides_other_roles(): void
    {
        $this->getJson('/api/v1/logistics/notifications')->assertUnauthorized();

        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/logistics/notifications')->assertForbidden();

        $logistics = $this->logistics();
        $logistics->update(['status' => UserStatus::Suspended]);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/notifications')->assertForbidden();
    }

    public function test_list_count_detail_and_mark_read_share_recipient_scope(): void
    {
        $logistics = $this->logistics();
        $other = $this->logistics('other-logistics@example.com');
        $own = $this->notification($logistics, [
            'pickup_request_id' => 'not-a-uuid',
            'order_count' => 2,
            'raw_secret' => 'do not expose',
        ]);
        $read = $this->notification($logistics, ['title' => 'Already read'], now()->subMinute());
        $read->update(['read_at' => now()->subSeconds(10)]);
        $foreign = $this->notification($other, ['title' => 'Foreign']);

        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/notifications?status=unread&per_page=10')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $own->id)
            ->assertJsonPath('data.0.title', 'New pickup request')
            ->assertJsonPath('data.0.summary', 'A Seller requested pickup for 2 Orders.')
            ->assertJsonPath('data.0.resource_id', null)
            ->assertJsonMissing(['raw_secret' => 'do not expose'])
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);

        $this->actingAs($logistics)
            ->getJson("/api/v1/logistics/notifications/{$foreign->id}")
            ->assertNotFound();

        $this->actingAs($logistics)
            ->getJson("/api/v1/logistics/notifications/{$own->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $own->id)
            ->assertJsonPath('data.read_at', null);

        $this->actingAs($logistics)
            ->postJson("/api/v1/logistics/notifications/{$own->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $own->id)
            ->assertJsonPath('data.read_at', fn ($value): bool => is_string($value));

        $firstReadAt = $logistics->notifications()->whereKey($own->id)->value('read_at');
        $this->actingAs($logistics)->postJson("/api/v1/logistics/notifications/{$own->id}/read")->assertOk();
        $this->assertEquals($firstReadAt, $logistics->notifications()->whereKey($own->id)->value('read_at'));
    }

    public function test_unknown_filters_and_read_body_are_rejected(): void
    {
        $logistics = $this->logistics();
        $notification = $this->notification($logistics);

        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/notifications?type=secret')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('type');

        $this->actingAs($logistics)
            ->postJson("/api/v1/logistics/notifications/{$notification->id}/read", ['read_at' => 'now'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('read_at');
    }

    public function test_malformed_legacy_data_does_not_break_the_inbox(): void
    {
        $logistics = $this->logistics();
        $notification = $logistics->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'logistics-pickup.requested',
            'data' => '{not valid json',
        ]);

        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.id', $notification->id)
            ->assertJsonPath('data.0.title', 'New pickup request')
            ->assertJsonPath('data.0.summary', 'A Seller requested a pickup.');
    }

    public function test_courier_application_delivery_is_after_commit_and_deduplicated(): void
    {
        $logistics = $this->logistics();
        $courier = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Pending]);

        DB::transaction(function () use ($logistics, $courier): void {
            $org = $logistics->logisticsOrganization()->firstOrFail();
            $affiliation = $courier->courierLogisticsAffiliation()->create([
                'logistics_organization_id' => $org->id,
                'logistics_hub_id' => $org->hub->id,
                'status' => CourierAffiliationStatus::Pending,
            ]);
            app(LogisticsNotificationService::class)->queueCourierApplicationPending($affiliation);
        });

        app(LogisticsNotificationService::class)->queueCourierApplicationPending(
            $courier->courierLogisticsAffiliation()->firstOrFail(),
        );

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $logistics->id,
            'type' => 'logistics-courier.application-pending',
        ]);
    }

    public function test_rolled_back_source_transactions_do_not_create_notifications(): void
    {
        $logistics = $this->logistics();
        $courier = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Pending]);

        try {
            DB::transaction(function () use ($logistics, $courier): void {
                $org = $logistics->logisticsOrganization()->firstOrFail();
                $affiliation = $courier->courierLogisticsAffiliation()->create([
                    'logistics_organization_id' => $org->id,
                    'logistics_hub_id' => $org->hub->id,
                    'status' => CourierAffiliationStatus::Pending,
                ]);
                app(LogisticsNotificationService::class)->queueCourierApplicationPending($affiliation);
                throw new \RuntimeException('rollback source transaction');
            });
        } catch (\RuntimeException) {
            // Expected rollback.
        }

        $this->assertDatabaseCount('notifications', 0);
    }

    private function logistics(string $email = 'logistics-notifications@example.com'): User
    {
        $user = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $address = $user->addresses()->create([
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
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Logistics']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Hub']);

        return $user;
    }

    /** @param array<string, mixed> $data */
    private function notification(User $logistics, array $data = [], ?\DateTimeInterface $createdAt = null): DatabaseNotification
    {
        $notification = $logistics->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'logistics-pickup.requested',
            'data' => $data,
        ]);
        if ($createdAt !== null) {
            $notification->created_at = $createdAt;
            $notification->save();
        }

        return $notification;
    }
}
