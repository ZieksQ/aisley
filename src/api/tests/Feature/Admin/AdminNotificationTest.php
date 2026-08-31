<?php

namespace Tests\Feature\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\RegistrationApplication;
use App\Models\User;
use App\Notifications\Admin\PendingRegistrationNotification;
use App\Services\Notifications\AdminNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_notification_endpoints_require_active_admin_and_explicit_permission(): void
    {
        $this->getJson('/api/v1/admin/notifications')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)->getJson('/api/v1/admin/notifications')->assertForbidden();

        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($admin)
            ->getJson('/api/v1/admin/notifications')
            ->assertForbidden();
    }

    public function test_admin_can_list_only_their_notifications_and_mark_read_idempotently(): void
    {
        $admin = $this->adminWithPermissions('notifications.view');
        $otherAdmin = $this->adminWithPermissions('notifications.view');
        $own = $this->databaseNotification($admin, '/registrations/'.Str::uuid());
        $other = $this->databaseNotification($otherAdmin, '/registrations/'.Str::uuid());

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/notifications?status=unread&per_page=10')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $own->id)
            ->assertJsonMissing(['id' => $other->id])
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/notifications/{$other->id}/read")
            ->assertNotFound();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/notifications/{$own->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $own->id)
            ->assertJsonPath('data.read_at', fn ($value) => is_string($value));

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/notifications/{$own->id}/read")
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/notifications/unread-count')
            ->assertJsonPath('unread_count', 0);
    }

    public function test_mark_all_read_is_scoped_to_authenticated_admin(): void
    {
        $admin = $this->adminWithPermissions('notifications.view');
        $otherAdmin = $this->adminWithPermissions('notifications.view');
        $this->databaseNotification($admin, '/dashboard');
        $this->databaseNotification($admin, '/account');
        $other = $this->databaseNotification($otherAdmin, '/dashboard');

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('updated_count', 2);

        $this->assertSame(0, $admin->unreadNotifications()->count());
        $this->assertNull($other->fresh()->read_at);
    }

    public function test_resource_removes_untrusted_external_destination(): void
    {
        $admin = $this->adminWithPermissions('notifications.view');
        $notification = $this->databaseNotification($admin, 'https://attacker.example/path');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.id', $notification->id)
            ->assertJsonPath('data.0.destination', null);
    }

    public function test_registration_submission_targets_only_authorized_active_admins(): void
    {
        Notification::fake();
        $eligible = $this->adminWithPermissions('notifications.view', 'registrations.view');
        $missingSourcePermission = $this->adminWithPermissions('notifications.view');
        $inactive = $this->adminWithPermissions('notifications.view', 'registrations.view');
        $inactive->update(['status' => UserStatus::Suspended]);
        $applicant = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Pending,
        ]);
        $application = RegistrationApplication::create([
            'user_id' => $applicant->id,
            'application_type' => UserRole::Seller,
            'status' => ApplicationStatus::Pending,
            'submitted_at' => now(),
        ]);

        app(AdminNotificationService::class)->registrationSubmitted($application);

        Notification::assertSentTo($eligible, PendingRegistrationNotification::class, function ($notification): bool {
            $payload = $notification->toDatabase(new \stdClass);

            return $notification->databaseType(new \stdClass) === 'account-registration.pending'
                && str_starts_with($payload['destination'], '/registrations/')
                && ! array_key_exists('email', $payload);
        });
        Notification::assertNotSentTo($missingSourcePermission, PendingRegistrationNotification::class);
        Notification::assertNotSentTo($inactive, PendingRegistrationNotification::class);
    }

    public function test_retrying_registration_delivery_does_not_duplicate_the_inbox_record(): void
    {
        $admin = $this->adminWithPermissions('notifications.view', 'registrations.view');
        $applicant = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Pending,
        ]);
        $application = RegistrationApplication::create([
            'user_id' => $applicant->id,
            'application_type' => UserRole::Customer,
            'status' => ApplicationStatus::Pending,
            'submitted_at' => now(),
        ]);
        $service = app(AdminNotificationService::class);

        $service->registrationSubmitted($application);
        $service->registrationSubmitted($application);

        $this->assertSame(1, $admin->notifications()->count());
        $this->assertSame('account-registration.pending', $admin->notifications()->firstOrFail()->type);
    }

    private function adminWithPermissions(string ...$slugs): User
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);

        foreach ($slugs as $slug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => Str::headline($slug), 'description' => 'Test permission.'],
            );
            AdminPermission::create([
                'admin_id' => $admin->id,
                'permission_id' => $permission->id,
            ]);
        }

        return $admin;
    }

    private function databaseNotification(User $admin, string $destination): DatabaseNotification
    {
        return $admin->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'account-registration.pending',
            'data' => [
                'title' => 'New Seller registration',
                'summary' => 'A new Seller registration is waiting for review.',
                'resource_type' => 'registration_application',
                'resource_id' => (string) Str::uuid(),
                'destination' => $destination,
            ],
        ]);
    }
}
