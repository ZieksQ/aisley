<?php

namespace Tests\Feature\Notifications;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationCategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_category_filters_and_metadata_are_returned_with_the_page(): void
    {
        $customer = $this->account(UserRole::Customer);
        $supportId = (string) Str::uuid();
        $this->notification($customer, 'support-ticket.admin-replied', $this->supportData($supportId, UserRole::Customer));
        $this->notification($customer, 'customer-order.status-changed', ['status' => 'delivered', 'order_id' => (string) Str::uuid()]);

        $this->actingAs($customer)->getJson('/api/v1/customer/notifications?category=support&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.categories.1.key', 'support')
            ->assertJsonPath('meta.categories.1.label', 'Support tickets')
            ->assertJsonPath('data.0.category', 'support')
            ->assertJsonPath('data.0.category_label', 'Support tickets')
            ->assertJsonPath('data.0.resource_type', 'support_ticket')
            ->assertJsonPath('data.0.resource_id', $supportId)
            ->assertJsonPath('data.0.destination', "/account/support-tickets?ticket={$supportId}");

        $this->actingAs($customer)->getJson('/api/v1/customer/notifications?category=all')
            ->assertOk()->assertJsonPath('meta.total', 2);
        $this->actingAs($customer)->getJson('/api/v1/customer/notifications?category=unknown')
            ->assertUnprocessable()->assertJsonValidationErrors('category');

        $invalidDestination = $this->notification($customer, 'support-ticket.admin-replied', [
            ...$this->supportData((string) Str::uuid(), UserRole::Customer),
            'destination' => 'https://attacker.example/ticket',
        ]);
        $this->actingAs($customer)->getJson("/api/v1/customer/notifications/{$invalidDestination->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Notification')
            ->assertJsonPath('data.resource_type', null)
            ->assertJsonPath('data.resource_id', null)
            ->assertJsonPath('data.destination', null);
    }

    public function test_seller_category_filter_keeps_support_destinations_role_scoped(): void
    {
        $seller = $this->account(UserRole::Seller);
        $supportId = (string) Str::uuid();
        $this->notification($seller, 'support-ticket.admin-replied', $this->supportData($supportId, UserRole::Seller));
        $this->notification($seller, 'seller-order.actionable', []);

        $this->actingAs($seller)->getJson('/api/v1/seller/notifications?category=support&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.category', 'support')
            ->assertJsonPath('data.0.category_label', 'Support tickets')
            ->assertJsonPath('data.0.destination', "/support-tickets?ticket={$supportId}");

        $this->actingAs($seller)->getJson('/api/v1/seller/notifications?category=')
            ->assertUnprocessable()->assertJsonValidationErrors('category');

        $invalidDestination = $this->notification($seller, 'support-ticket.admin-replied', [
            ...$this->supportData((string) Str::uuid(), UserRole::Seller),
            'destination' => '//attacker.example/ticket',
        ]);
        $this->actingAs($seller)->getJson("/api/v1/seller/notifications/{$invalidDestination->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Notification')
            ->assertJsonPath('data.resource_type', null)
            ->assertJsonPath('data.resource_id', null)
            ->assertJsonPath('data.destination', null);
    }

    public function test_admin_category_and_type_filters_intersect_and_other_catches_visible_legacy_types(): void
    {
        $admin = $this->admin('notifications.view', 'support-tickets.view');
        $supportId = (string) Str::uuid();
        $this->notification($admin, 'support-ticket.created', $this->supportData($supportId, UserRole::Admin));
        $this->notification($admin, 'account-registration.pending', ['destination' => '/registrations/'.Str::uuid()]);
        $this->notification($admin, 'legacy.unknown-event', ['destination' => '/dashboard']);

        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?category=support&type=account-registration.pending')
            ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.categories.1.label', 'Support tickets');

        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?category=support&type=support-ticket.created')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.category', 'support')
            ->assertJsonPath('data.0.destination', "/support-tickets/{$supportId}");

        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?category=other')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'legacy.unknown-event')
            ->assertJsonPath('data.0.category', 'other');
        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?category=unknown')
            ->assertUnprocessable()->assertJsonValidationErrors('category');

        $invalidDestination = $this->notification($admin, 'support-ticket.created', [
            ...$this->supportData((string) Str::uuid(), UserRole::Admin),
            'destination' => 'https://attacker.example/ticket',
        ]);
        $page = $this->actingAs($admin)->getJson('/api/v1/admin/notifications?category=support&type=support-ticket.created')
            ->assertOk();
        $invalidItem = collect($page->json('data'))->firstWhere('id', $invalidDestination->id);
        $this->assertSame('Notification', $invalidItem['title']);
        $this->assertNull($invalidItem['resource_type']);
        $this->assertNull($invalidItem['resource_id']);
        $this->assertNull($invalidItem['destination']);
    }

    public function test_logistics_category_filter_runs_before_page_pagination(): void
    {
        $logistics = $this->logistics();
        $supportId = (string) Str::uuid();
        $this->notification($logistics, 'support-ticket.admin-replied', $this->supportData($supportId, UserRole::Logistics));
        $this->notification($logistics, 'logistics-pickup.requested', []);

        $this->actingAs($logistics)->getJson('/api/v1/logistics/notifications?category=support&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.categories.5.key', 'support')
            ->assertJsonPath('data.0.category', 'support')
            ->assertJsonPath('data.0.category_label', 'Support tickets')
            ->assertJsonPath('data.0.destination', "/support-tickets?ticket={$supportId}");

        $this->actingAs($logistics)->getJson('/api/v1/logistics/notifications?category=bogus')
            ->assertUnprocessable()->assertJsonValidationErrors('category');

        $invalidDestination = $this->notification($logistics, 'support-ticket.admin-replied', [
            ...$this->supportData((string) Str::uuid(), UserRole::Logistics),
            'destination' => '/support-tickets?ticket=foreign',
        ]);
        $this->actingAs($logistics)->getJson("/api/v1/logistics/notifications/{$invalidDestination->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Notification')
            ->assertJsonPath('data.resource_type', null)
            ->assertJsonPath('data.resource_id', null)
            ->assertJsonPath('data.destination', null);
    }

    public function test_courier_category_filter_is_bound_to_the_signed_cursor(): void
    {
        [$courier] = $this->courier();
        foreach (range(1, 2) as $index) {
            $id = (string) Str::uuid();
            $this->notification($courier, 'support-ticket.admin-replied', $this->supportData($id, UserRole::Courier));
        }
        $this->notification($courier, 'pickup-schedule.assigned', []);

        $first = $this->actingAs($courier)->getJson('/api/v1/courier/notifications?category=support&limit=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.category', 'support')
            ->assertJsonPath('data.0.category_label', 'Support tickets')
            ->assertJsonPath('data.0.resource_type', 'support_ticket')
            ->assertJsonPath('data.0.destination', fn (string $destination): bool => preg_match('~^/support-tickets/[0-9a-f-]{36}$~i', $destination) === 1)
            ->assertJsonPath('meta.categories.3.key', 'support');
        $cursor = $first->json('meta.next_cursor');
        $this->assertIsString($cursor);

        $this->actingAs($courier)->getJson('/api/v1/courier/notifications?category=support&limit=1&cursor='.urlencode($cursor))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.category', 'support');
        $this->actingAs($courier)->getJson('/api/v1/courier/notifications?category=pickups&limit=1&cursor='.urlencode($cursor))
            ->assertUnprocessable()->assertJsonValidationErrors('cursor');
        $this->actingAs($courier)->getJson('/api/v1/courier/notifications?category=bogus')
            ->assertUnprocessable()->assertJsonValidationErrors('category');

        $invalidId = (string) Str::uuid();
        $invalidDestination = $this->notification($courier, 'support-ticket.admin-replied', [
            ...$this->supportData($invalidId, UserRole::Courier),
            'destination' => '/support-tickets/not-a-uuid',
        ]);
        $this->actingAs($courier)->getJson("/api/v1/courier/notifications/{$invalidDestination->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Notification')
            ->assertJsonPath('data.resource_type', null)
            ->assertJsonPath('data.resource_id', null)
            ->assertJsonPath('data.destination', null);
    }

    private function account(UserRole $role): User
    {
        return User::factory()->create([
            'email' => fake()->unique()->safeEmail(),
            'role' => $role,
            'status' => UserStatus::Active,
        ]);
    }

    private function admin(string ...$permissions): User
    {
        $admin = $this->account(UserRole::Admin);
        foreach ($permissions as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
            AdminPermission::query()->create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
        }

        return $admin;
    }

    private function logistics(): User
    {
        $user = $this->account(UserRole::Logistics);
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

    /** @return array{User} */
    private function courier(): array
    {
        $logistics = $this->logistics();
        $organization = $logistics->logisticsOrganization()->with('hub')->firstOrFail();
        $courier = $this->account(UserRole::Courier);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $organization->hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);

        return [$courier->fresh()];
    }

    /** @param array<string, mixed> $data */
    private function notification(User $recipient, string $type, array $data): DatabaseNotification
    {
        return $recipient->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => $type,
            'data' => $data,
        ]);
    }

    /** @return array<string, string> */
    private function supportData(string $ticketId, UserRole $role): array
    {
        $destination = match ($role) {
            UserRole::Customer => "/account/support-tickets?ticket={$ticketId}",
            UserRole::Seller, UserRole::Logistics => "/support-tickets?ticket={$ticketId}",
            UserRole::Admin, UserRole::Courier => "/support-tickets/{$ticketId}",
        };

        return [
            'title' => 'Support ticket update',
            'summary' => 'A reference-only summary.',
            'resource_type' => 'support_ticket',
            'resource_id' => $ticketId,
            'destination' => $destination,
            'ticket_reference' => 'SUP-'.strtoupper(str_replace('-', '', $ticketId)),
        ];
    }
}
