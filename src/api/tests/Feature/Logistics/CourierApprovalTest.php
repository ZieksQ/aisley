<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\ApplicationStatus;
use App\Enums\CourierAffiliationStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use App\Models\CourierLogisticsAffiliation;
use App\Models\Document;
use App\Models\RegistrationApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CourierApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('courier-approval-test');
    }

    public function test_only_an_active_logistics_account_can_review_applications(): void
    {
        $this->getJson('/api/v1/logistics/courier-applications')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)
            ->getJson('/api/v1/logistics/courier-applications')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $pending = $this->logistics('pending-reviewer@example.com');
        $pending->update(['status' => UserStatus::Pending]);
        $this->actingAs($pending)
            ->getJson('/api/v1/logistics/courier-applications')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $missingOrganization = User::factory()->create([
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($missingOrganization)
            ->getJson('/api/v1/logistics/courier-applications')
            ->assertForbidden();
    }

    public function test_logistics_sees_only_its_pending_applications_with_safe_pagination_and_search(): void
    {
        $logistics = $this->logistics('reviewer@example.com');
        $older = $this->courierApplication($logistics, 'older-courier@example.com', 'Alex', 'Older');
        $newer = $this->courierApplication($logistics, 'newer-courier@example.com', 'Bea', 'Newer');
        $otherOrganization = $this->logistics('other-reviewer@example.com');
        $foreign = $this->courierApplication($otherOrganization, 'foreign-courier@example.com', 'Foreign', 'Courier');

        $response = $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/courier-applications?per_page=1')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertJsonPath('data.0.id', $older['affiliation']->id)
            ->assertJsonPath('data.0.courier.name', 'Alex M Older')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonMissing(['id' => $foreign['affiliation']->id]);

        $this->assertStringNotContainsString($older['document']->path, $response->getContent());
        $this->assertStringNotContainsString($newer['document']->path, $response->getContent());

        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/courier-applications?search=NEWER')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $newer['affiliation']->id);
    }

    public function test_detail_and_evidence_are_private_and_use_the_couriers_submitted_address(): void
    {
        $logistics = $this->logistics('reviewer@example.com');
        $application = $this->courierApplication($logistics, 'courier@example.com', 'Casey', 'Rider');
        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/courier-applications/'.$application['affiliation']->id)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.courier.address.address_line_1', '99 Courier Street')
            ->assertJsonPath('data.courier.address.city_municipality', 'Makati City')
            ->assertJsonPath('data.organization.hub.name', 'reviewer@example.com hub')
            ->assertJsonPath('data.completeness.complete', true)
            ->assertJsonPath('data.documents.0.preview_url', '/api/v1/logistics/courier-applications/'.$application['affiliation']->id.'/documents/'.$application['document']->id);

        $this->actingAs($logistics)
            ->get('/api/v1/logistics/courier-applications/'.$application['affiliation']->id.'/documents/'.$application['document']->id)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertHeader('Content-Type', 'image/jpeg');

        Storage::disk('courier-approval-test')->delete($application['document']->path);
        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/courier-applications/'.$application['affiliation']->id.'/documents/'.$application['document']->id)
            ->assertNotFound()
            ->assertJsonPath('code', 'EVIDENCE_UNAVAILABLE')
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_cross_organization_and_foreign_documents_are_not_found(): void
    {
        $logistics = $this->logistics('reviewer@example.com');
        $otherOrganization = $this->logistics('other-reviewer@example.com');
        $application = $this->courierApplication($otherOrganization, 'courier@example.com');

        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/courier-applications/'.$application['affiliation']->id)
            ->assertNotFound();

        $own = $this->courierApplication($logistics, 'own-courier@example.com');
        $this->actingAs($logistics)
            ->get('/api/v1/logistics/courier-applications/'.$own['affiliation']->id.'/documents/'.$application['document']->id)
            ->assertNotFound();
    }

    public function test_approval_requires_complete_registration_and_commits_all_related_statuses(): void
    {
        $logistics = $this->logistics('reviewer@example.com');
        $incomplete = $this->courierApplication($logistics, 'incomplete@example.com', complete: false);

        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$incomplete['affiliation']->id.'/approve')
            ->assertConflict()
            ->assertJsonPath('code', 'COURIER_APPLICATION_INCOMPLETE')
            ->assertJsonPath('data.missing.0', 'address');

        $this->assertSame(CourierAffiliationStatus::Pending, $incomplete['affiliation']->fresh()->status);
        $this->assertSame(ApplicationStatus::Pending, $incomplete['application']->fresh()->status);
        $this->assertSame(UserStatus::Pending, $incomplete['courier']->fresh()->status);

        $complete = $this->courierApplication($logistics, 'complete@example.com');
        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$complete['affiliation']->id.'/approve')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Courier approved.')
            ->assertJsonPath('data.status', CourierAffiliationStatus::Approved->value)
            ->assertJsonPath('data.application.status', ApplicationStatus::Approved->value)
            ->assertJsonPath('data.courier.account_status', UserStatus::Active->value);

        $this->assertSame(CourierAffiliationStatus::Approved, $complete['affiliation']->fresh()->status);
        $this->assertSame(ApplicationStatus::Approved, $complete['application']->fresh()->status);
        $this->assertSame(UserStatus::Active, $complete['courier']->fresh()->status);
        $this->assertSame(DocumentStatus::Verified, $complete['document']->fresh()->status);
        $this->assertSame($logistics->id, $complete['document']->fresh()->reviewer_id);
    }

    public function test_rejection_requires_a_reason_and_cannot_be_overwritten(): void
    {
        $logistics = $this->logistics('reviewer@example.com');
        $application = $this->courierApplication($logistics, 'courier@example.com');

        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$application['affiliation']->id.'/reject')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$application['affiliation']->id.'/reject', ['reason' => str_repeat('x', 2001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$application['affiliation']->id.'/reject', ['reason' => '  Please provide a readable vehicle registration. '])
            ->assertOk()
            ->assertJsonPath('data.status', CourierAffiliationStatus::Rejected->value)
            ->assertJsonPath('data.application.rejection_reason', 'Please provide a readable vehicle registration.')
            ->assertJsonPath('data.review.reason', 'Please provide a readable vehicle registration.');

        $this->assertSame(UserStatus::Rejected, $application['courier']->fresh()->status);
        $this->assertSame(DocumentStatus::Rejected, $application['document']->fresh()->status);

        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$application['affiliation']->id.'/approve')
            ->assertConflict()
            ->assertJsonPath('code', 'COURIER_APPLICATION_REVIEWED');
    }

    public function test_suspension_and_deactivation_are_not_overwritten_by_rejection_or_approval(): void
    {
        $logistics = $this->logistics('reviewer@example.com');
        $suspended = $this->courierApplication($logistics, 'suspended@example.com');
        $suspended['courier']->update(['status' => UserStatus::Suspended]);

        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$suspended['affiliation']->id.'/reject', ['reason' => 'Account requires Admin review.'])
            ->assertOk();
        $this->assertSame(UserStatus::Suspended, $suspended['courier']->fresh()->status);

        $deactivated = $this->courierApplication($logistics, 'deactivated@example.com');
        $deactivated['courier']->update(['status' => UserStatus::Deactivated]);
        $this->actingAs($logistics)
            ->postJson('/api/v1/logistics/courier-applications/'.$deactivated['affiliation']->id.'/approve')
            ->assertConflict()
            ->assertJsonPath('code', 'COURIER_ACCOUNT_STATE_CONFLICT')
            ->assertJsonPath('data.account_status', UserStatus::Deactivated->value);
        $this->assertSame(CourierAffiliationStatus::Pending, $deactivated['affiliation']->fresh()->status);
    }

    /** @return array{courier: User, application: RegistrationApplication, affiliation: CourierLogisticsAffiliation, document: Document} */
    private function courierApplication(User $logistics, string $email, string $firstName = 'Alex', string $lastName = 'Applicant', bool $complete = true): array
    {
        $courier = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Courier,
            'status' => UserStatus::Pending,
        ]);
        $profile = $courier->courierProfile()->create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'middle_name' => 'M',
            'contact_number' => '09171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1995-05-10',
        ]);

        if ($complete) {
            $courier->addresses()->create([
                'type' => AddressType::Both,
                'label' => 'Courier residence',
                'recipient_name' => $firstName.' '.$lastName,
                'contact_number' => '09171234567',
                'address_line_1' => '99 Courier Street',
                'barangay' => 'Poblacion',
                'city_municipality' => 'Makati City',
                'province' => 'Metro Manila',
                'region' => 'National Capital Region',
                'postal_code' => '1200',
                'country' => 'Philippines',
                'is_default' => true,
            ]);
            $profile->vehicles()->create([
                'plate_number' => 'ABC-'.strtoupper(substr(md5($email), 0, 4)),
                'type' => VehicleType::Motorcycle,
                'status' => VehicleStatus::Active,
            ]);
        }

        $application = $courier->registrationApplications()->create([
            'application_type' => UserRole::Courier,
            'status' => ApplicationStatus::Pending,
            'submitted_at' => now(),
        ]);
        Storage::disk('courier-approval-test')->put('evidence/'.$courier->id.'/id.jpg', 'private evidence');
        $document = $application->documents()->create([
            'user_id' => $courier->id,
            'type' => DocumentType::GovernmentId,
            'status' => DocumentStatus::Pending,
            'disk' => 'courier-approval-test',
            'path' => 'evidence/'.$courier->id.'/id.jpg',
            'original_name' => 'government-id.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 16,
        ]);
        if ($complete) {
            Storage::disk('courier-approval-test')->put('evidence/'.$courier->id.'/or-cr.jpg', 'private evidence');
            $application->documents()->create([
                'user_id' => $courier->id,
                'type' => DocumentType::VehicleRegistration,
                'status' => DocumentStatus::Pending,
                'disk' => 'courier-approval-test',
                'path' => 'evidence/'.$courier->id.'/or-cr.jpg',
                'original_name' => 'vehicle-or-cr.jpg',
                'mime_type' => 'image/jpeg',
                'size_bytes' => 16,
            ]);
        }
        $affiliation = $logistics->logisticsOrganization()->firstOrFail()->courierAffiliations()->create([
            'courier_id' => $courier->id,
            'logistics_hub_id' => $logistics->logisticsOrganization()->firstOrFail()->hub->id,
            'status' => CourierAffiliationStatus::Pending,
        ]);

        return compact('courier', 'application', 'affiliation', 'document');
    }

    private function logistics(string $email): User
    {
        $user = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $user->logisticsProfile()->create([
            'first_name' => 'Logistics',
            'last_name' => 'Reviewer',
            'contact_number' => '09171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1990-01-01',
        ]);
        $address = $user->addresses()->create([
            'type' => AddressType::Both,
            'label' => 'Operational hub',
            'recipient_name' => 'Logistics Reviewer',
            'contact_number' => '09171234567',
            'address_line_1' => '1 Logistics Road',
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region',
            'postal_code' => '1200',
            'country' => 'Philippines',
            'is_default' => true,
        ]);
        $organization = $user->logisticsOrganization()->create(['business_name' => $email.' organization']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => $email.' hub']);

        return $user;
    }
}
