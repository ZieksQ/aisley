<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\ApplicationStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Document;
use App\Models\Permission;
use App\Models\RegistrationApplication;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\Admin\RegistrationDecisionNotification;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegistrationManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_non_admin_and_admin_without_permission_cannot_list_registrations(): void
    {
        $this->getJson('/api/v1/admin/registrations')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)->getJson('/api/v1/admin/registrations')->assertForbidden();

        $admin = $this->admin();
        $this->actingAs($admin)
            ->getJson('/api/v1/admin/registrations')
            ->assertForbidden()
            ->assertJsonPath('message', 'You do not have permission to perform this action.');
    }

    public function test_registration_queue_defaults_to_pending_oldest_first_and_excludes_couriers(): void
    {
        $admin = $this->adminWithPermissions('registrations.view');
        $newer = $this->application(UserRole::Seller, ApplicationStatus::Pending, now()->subDay(), 'newer@example.com');
        $older = $this->application(UserRole::Customer, ApplicationStatus::Pending, now()->subDays(2), 'older@example.com');
        $this->application(UserRole::Customer, ApplicationStatus::Approved, now()->subDays(3), 'approved@example.com');
        $this->application(UserRole::Courier, ApplicationStatus::Pending, now()->subDays(4), 'courier@example.com');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/registrations?per_page=1')
            ->assertOk()
            ->assertJsonPath('data.0.id', $older->id)
            ->assertJsonPath('data.0.role', UserRole::Customer->value)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonMissing(['id' => $newer->id]);
    }

    public function test_admin_can_filter_and_search_registration_queue(): void
    {
        $admin = $this->adminWithPermissions('registrations.view');
        $this->application(UserRole::Customer, ApplicationStatus::Pending, now(), 'pat@example.com', 'Patricia', 'Rivera');
        $seller = $this->application(UserRole::Seller, ApplicationStatus::Rejected, now(), 'store@example.com', 'Sam', 'Merchant');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/registrations?status=rejected&role=seller&search=merchant')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $seller->id)
            ->assertJsonPath('data.0.applicant.name', 'Sam Merchant');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/registrations?role=courier')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_admin_can_view_role_specific_details_without_sensitive_fields(): void
    {
        $admin = $this->adminWithPermissions('registrations.view');
        $registration = $this->application(
            UserRole::Seller,
            ApplicationStatus::Pending,
            now(),
            'seller@example.com',
            'Selena',
            'Shopkeeper',
        );
        Document::create([
            'user_id' => $registration->user_id,
            'registration_application_id' => $registration->id,
            'type' => DocumentType::BusinessRegistration,
            'status' => DocumentStatus::Pending,
            'disk' => 'private',
            'path' => 'registrations/secret.pdf',
            'original_name' => 'business.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 2048,
            'checksum' => 'secret-checksum',
        ]);

        $response = $this->actingAs($admin)
            ->getJson("/api/v1/admin/registrations/{$registration->id}")
            ->assertOk()
            ->assertJsonPath('data.applicant.name', 'Selena Shopkeeper')
            ->assertJsonPath('data.application.contact_number', '09171234567')
            ->assertJsonPath('data.documents.0.original_name', 'business.pdf');

        $payload = $response->json();
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('registrations/secret.pdf', $encoded);
        $this->assertStringNotContainsString('secret-checksum', $encoded);
        $this->assertStringNotContainsString('password', $encoded);
    }

    public function test_authorized_admin_can_approve_pending_registration(): void
    {
        Notification::fake();
        $admin = $this->adminWithPermissions('registrations.review');
        $registration = $this->application(UserRole::Customer, ApplicationStatus::Pending);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/registrations/{$registration->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', ApplicationStatus::Approved->value)
            ->assertJsonPath('data.review.reviewed_by.id', $admin->id);

        $registration->refresh();
        $this->assertSame(ApplicationStatus::Approved, $registration->status);
        $this->assertSame($admin->id, $registration->reviewer_id);
        $this->assertNotNull($registration->reviewed_at);
        $this->assertSame(UserStatus::Active, $registration->user->fresh()->status);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => AdminAuditAction::RegistrationApproved->value,
            'auditable_id' => $registration->id,
        ]);
        Notification::assertSentTo($registration->user, RegistrationDecisionNotification::class);
    }

    public function test_approving_a_seller_activates_the_pending_shop_and_verifies_evidence(): void
    {
        Notification::fake();
        $admin = $this->adminWithPermissions('registrations.review');
        $registration = $this->application(UserRole::Seller, ApplicationStatus::Pending);
        $shop = Shop::create([
            'seller_id' => $registration->user_id,
            'name' => 'Pending Seller Shop',
            'slug' => 'pending-seller-shop',
            'status' => ShopStatus::Pending,
        ]);
        $document = Document::create([
            'user_id' => $registration->user_id,
            'registration_application_id' => $registration->id,
            'type' => DocumentType::GovernmentId,
            'status' => DocumentStatus::Pending,
            'disk' => 'local',
            'path' => 'registration-evidence/id.jpg',
            'original_name' => 'id.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
        ]);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/registrations/{$registration->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.application.business.status', ShopStatus::Active->value)
            ->assertJsonPath('data.documents.0.status', DocumentStatus::Verified->value);

        $this->assertSame(ShopStatus::Active, $shop->fresh()->status);
        $this->assertSame(DocumentStatus::Verified, $document->fresh()->status);
        $this->assertSame($admin->id, $document->fresh()->reviewer_id);
    }

    public function test_authorized_admin_can_download_registration_evidence_but_other_documents_are_hidden(): void
    {
        Storage::fake('admin-registration-evidence');
        $admin = $this->adminWithPermissions('registrations.view');
        $registration = $this->application(UserRole::Seller, ApplicationStatus::Pending);
        $other = $this->application(UserRole::Seller, ApplicationStatus::Pending);
        Storage::disk('admin-registration-evidence')->put('registration-evidence/id.jpg', 'private-image');
        $document = Document::create([
            'user_id' => $registration->user_id,
            'registration_application_id' => $registration->id,
            'type' => DocumentType::GovernmentId,
            'status' => DocumentStatus::Pending,
            'disk' => 'admin-registration-evidence',
            'path' => 'registration-evidence/id.jpg',
            'original_name' => 'id.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 13,
        ]);

        $this->actingAs($admin)
            ->get("/api/v1/admin/registrations/{$registration->id}/documents/{$document->id}")
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private');

        $this->actingAs($admin)
            ->get("/api/v1/admin/registrations/{$other->id}/documents/{$document->id}")
            ->assertNotFound();
    }

    public function test_authorized_admin_can_reject_pending_registration_with_optional_reason(): void
    {
        Notification::fake();
        $admin = $this->adminWithPermissions('registrations.review');
        $registration = $this->application(UserRole::Seller, ApplicationStatus::Pending);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/registrations/{$registration->id}/reject", [
                'reason' => 'The submitted details could not be verified.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', ApplicationStatus::Rejected->value)
            ->assertJsonPath('data.review.rejection_reason', 'The submitted details could not be verified.');

        $registration->refresh();
        $this->assertSame(UserStatus::Rejected, $registration->user->fresh()->status);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => AdminAuditAction::RegistrationRejected->value,
            'auditable_id' => $registration->id,
        ]);
        Notification::assertSentTo($registration->user, RegistrationDecisionNotification::class);
    }

    public function test_reviewed_registration_cannot_be_overwritten_or_notify_twice(): void
    {
        Notification::fake();
        $firstAdmin = $this->adminWithPermissions('registrations.review');
        $secondAdmin = $this->adminWithPermissions('registrations.review');
        $registration = $this->application(UserRole::Customer, ApplicationStatus::Pending);

        $this->actingAs($firstAdmin)
            ->postJson("/api/v1/admin/registrations/{$registration->id}/approve")
            ->assertOk();

        $this->actingAs($secondAdmin)
            ->postJson("/api/v1/admin/registrations/{$registration->id}/reject")
            ->assertConflict()
            ->assertJsonPath('message', 'This registration has already been reviewed.');

        $registration->refresh();
        $this->assertSame(ApplicationStatus::Approved, $registration->status);
        $this->assertSame($firstAdmin->id, $registration->reviewer_id);
        $this->assertDatabaseCount('audit_logs', 1);
        Notification::assertSentToTimes($registration->user, RegistrationDecisionNotification::class, 1);
    }

    public function test_decision_targets_registration_id_and_does_not_change_same_email_other_role(): void
    {
        $admin = $this->adminWithPermissions('registrations.review');
        $customer = $this->application(UserRole::Customer, ApplicationStatus::Pending, now(), 'shared@example.com');
        $seller = $this->application(UserRole::Seller, ApplicationStatus::Pending, now(), 'shared@example.com');

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/registrations/{$seller->id}/approve")
            ->assertOk();

        $this->assertSame(UserStatus::Pending, $customer->user->fresh()->status);
        $this->assertSame(ApplicationStatus::Pending, $customer->fresh()->status);
        $this->assertSame(UserStatus::Active, $seller->user->fresh()->status);
    }

    public function test_courier_registration_cannot_be_viewed_or_decided_by_platform_admin(): void
    {
        $admin = $this->adminWithPermissions('registrations.view', 'registrations.review');
        $registration = $this->application(UserRole::Courier, ApplicationStatus::Pending);

        $this->actingAs($admin)
            ->getJson("/api/v1/admin/registrations/{$registration->id}")
            ->assertNotFound();
        $this->actingAs($admin)
            ->postJson("/api/v1/admin/registrations/{$registration->id}/approve")
            ->assertNotFound();
    }

    public function test_database_seeder_grants_registration_permissions_to_initial_admin(): void
    {
        config()->set('admin.initial', [
            'email' => 'seeded-admin@example.com',
            'password' => 'SeededAdmin123',
            'first_name' => 'Seeded',
            'last_name' => 'Administrator',
        ]);

        $this->seed(DatabaseSeeder::class);

        $admin = User::query()
            ->where('email', 'seeded-admin@example.com')
            ->where('role', UserRole::Admin)
            ->firstOrFail();

        $this->assertEqualsCanonicalizing(
            ['registrations.view', 'registrations.review', 'audit-logs.view'],
            $admin->permissions()->pluck('slug')->all(),
        );
    }

    private function admin(): User
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        $admin->adminProfile()->create([
            'first_name' => 'Avery',
            'last_name' => 'Admin',
        ]);

        return $admin;
    }

    private function adminWithPermissions(string ...$slugs): User
    {
        $admin = $this->admin();

        foreach ($slugs as $slug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => $slug],
            );
            AdminPermission::create([
                'admin_id' => $admin->id,
                'permission_id' => $permission->id,
            ]);
        }

        return $admin;
    }

    private function application(
        UserRole $role,
        ApplicationStatus $status,
        mixed $submittedAt = null,
        ?string $email = null,
        string $firstName = 'Alex',
        string $lastName = 'Applicant',
    ): RegistrationApplication {
        $user = User::factory()->create([
            'email' => $email ?? fake()->unique()->safeEmail(),
            'role' => $role,
            'status' => $status === ApplicationStatus::Approved ? UserStatus::Active : UserStatus::Pending,
        ]);

        $profile = [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'contact_number' => '09171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1995-05-10',
        ];

        match ($role) {
            UserRole::Customer => $user->customerProfile()->create($profile),
            UserRole::Seller => $user->sellerProfile()->create($profile),
            UserRole::Courier => $user->courierProfile()->create($profile),
            UserRole::Admin => $user->adminProfile()->create($profile),
        };

        return RegistrationApplication::create([
            'user_id' => $user->id,
            'application_type' => $role,
            'status' => $status,
            'submitted_at' => $submittedAt ?? now(),
        ]);
    }
}
