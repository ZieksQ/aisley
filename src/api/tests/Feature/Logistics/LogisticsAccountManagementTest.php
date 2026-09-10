<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LogisticsAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('logistics-profile-test');
        config()->set('filesystems.default', 'logistics-profile-test');
    }

    public function test_only_an_active_logistics_account_can_read_its_private_projection(): void
    {
        $this->getJson('/api/v1/logistics/account')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)
            ->getJson('/api/v1/logistics/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $logistics = $this->logistics();
        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/account')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertJsonPath('account.id', $logistics->id)
            ->assertJsonPath('account.email', 'logistics@example.com')
            ->assertJsonPath('account.role', 'logistics')
            ->assertJsonPath('account.status', 'active')
            ->assertJsonPath('account.profile.first_name', 'Logan')
            ->assertJsonPath('account.profile.middle_name', 'A')
            ->assertJsonPath('account.profile.last_name', 'Operator')
            ->assertJsonPath('account.profile.sex', 'male')
            ->assertJsonPath('account.organization.business_name', 'Aisley Delivery Services')
            ->assertJsonPath('account.hub.name', 'Aisley operational hub')
            ->assertJsonPath('account.hub.address.postal_code', '1200')
            ->assertJsonPath('account.security.email_editable', false)
            ->assertJsonPath('account.security.profile_photo_editable', true)
            ->assertJsonPath('account.profile.profile_photo_url', null)
            ->assertJsonPath('account.security.hub_address_editable', false)
            ->assertJsonMissingPath('account.password')
            ->assertJsonMissingPath('account.organization.courier_affiliations');
    }

    public function test_pending_accounts_and_missing_foundation_relationships_fail_closed(): void
    {
        $pending = $this->logistics('pending@example.com', UserStatus::Pending);
        $this->actingAs($pending)
            ->getJson('/api/v1/logistics/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $missingOrganization = User::factory()->create([
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $missingOrganization->logisticsProfile()->create([
            'first_name' => 'Missing',
            'last_name' => 'Organization',
            'contact_number' => '09170000000',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1990-01-01',
        ]);

        $this->actingAs($missingOrganization)
            ->getJson('/api/v1/logistics/account')
            ->assertNotFound();

        $missingHub = $this->logistics('missing-hub@example.com');
        $missingHub->logisticsOrganization()->firstOrFail()->hub()->delete();
        $this->actingAs($missingHub)
            ->getJson('/api/v1/logistics/account')
            ->assertNotFound();
    }

    public function test_logistics_can_update_allow_listed_profile_fields_and_get_the_latest_projection(): void
    {
        $logistics = $this->logistics();

        $this->actingAs($logistics)
            ->patchJson('/api/v1/logistics/account/profile', [
                'first_name' => '  Lina ',
                'middle_name' => '   ',
                'contact_number' => ' 09179999999 ',
                'sex' => 'female',
                'birth_date' => '1992-05-10',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('account.profile.first_name', 'Lina')
            ->assertJsonPath('account.profile.middle_name', null)
            ->assertJsonPath('account.profile.last_name', 'Operator')
            ->assertJsonPath('account.profile.contact_number', '09179999999')
            ->assertJsonPath('account.profile.sex', 'female')
            ->assertJsonPath('account.profile.birth_date', '1992-05-10');

        $this->patchJson('/api/v1/logistics/account/profile', ['last_name' => 'Committed'])
            ->assertOk()
            ->assertJsonPath('account.profile.first_name', 'Lina')
            ->assertJsonPath('account.profile.last_name', 'Committed');

        $profile = $logistics->logisticsProfile()->firstOrFail();
        $this->assertSame('Lina', $profile->first_name);
        $this->assertSame('Committed', $profile->last_name);
        $this->assertNull($profile->middle_name);
        $this->assertSame('09179999999', $profile->contact_number);
        $this->assertSame(UserSex::Female, $profile->sex);
        $this->assertSame('1992-05-10', $profile->birth_date?->toDateString());
    }

    public function test_profile_updates_reject_unknown_or_immutable_fields_without_partial_writes(): void
    {
        $logistics = $this->logistics();

        $this->actingAs($logistics)
            ->patchJson('/api/v1/logistics/account/profile', [
                'first_name' => 'Tampered',
                'email' => 'changed@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseHas('logistics_profiles', [
            'user_id' => $logistics->id,
            'first_name' => 'Logan',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $logistics->id,
            'email' => 'logistics@example.com',
        ]);

        $this->patchJson('/api/v1/logistics/account/profile', [
            'sex' => 'not-a-sex',
            'birth_date' => now()->addDay()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors(['sex', 'birth_date']);
    }

    public function test_logistics_can_update_organization_and_hub_name_but_not_the_hub_address(): void
    {
        $logistics = $this->logistics();
        $hub = $logistics->logisticsOrganization()->firstOrFail()->hub()->firstOrFail();
        $addressId = $hub->address_id;

        $this->actingAs($logistics)
            ->patchJson('/api/v1/logistics/account/organization', [
                'business_name' => '  New Logistics Co. ',
                'hub_name' => '  North sorting center ',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Organization details updated successfully.')
            ->assertJsonPath('account.organization.business_name', 'New Logistics Co.')
            ->assertJsonPath('account.hub.name', 'North sorting center')
            ->assertJsonPath('account.hub.address.postal_code', '1200');

        $this->assertDatabaseHas('logistics_organizations', [
            'id' => $logistics->logisticsOrganization()->value('id'),
            'business_name' => 'New Logistics Co.',
        ]);
        $this->assertDatabaseHas('logistics_hubs', [
            'id' => $hub->id,
            'name' => 'North sorting center',
            'address_id' => $addressId,
        ]);

        $this->patchJson('/api/v1/logistics/account/organization', [
            'address_id' => '00000000-0000-0000-0000-000000000000',
        ])->assertUnprocessable()->assertJsonValidationErrors('address_id');
        $this->assertDatabaseHas('logistics_hubs', ['id' => $hub->id, 'address_id' => $addressId]);
    }

    public function test_password_change_requires_current_password_and_revokes_all_bearer_tokens(): void
    {
        $logistics = $this->logistics();
        $first = $logistics->createToken('browser');
        $second = $logistics->createToken('mobile');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/logistics/account/password', [
                'current_password' => 'wrong-password',
                'password' => 'UpdatedLogistics456',
                'password_confirmation' => 'UpdatedLogistics456',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/logistics/account/password', [
                'current_password' => 'CurrentLogistics123',
                'password' => 'UpdatedLogistics456',
                'password_confirmation' => 'UpdatedLogistics456',
            ])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Password updated successfully. All Logistics access tokens have been revoked.')
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('token');

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertTrue(Hash::check('UpdatedLogistics456', $logistics->fresh()->password));
        $this->app['auth']->forgetGuards();
        $this->withToken($second->plainTextToken)->getJson('/api/v1/logistics/account')->assertUnauthorized();
    }

    public function test_password_change_rejects_immutable_fields(): void
    {
        $logistics = $this->logistics('throttle@example.com');

        $this->actingAs($logistics)
            ->putJson('/api/v1/logistics/account/password', [
                'current_password' => 'CurrentLogistics123',
                'password' => 'short',
                'password_confirmation' => 'short',
                'email' => 'tampered@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password', 'email']);
    }

    public function test_password_change_is_throttled(): void
    {
        $logistics = $this->logistics('throttle@example.com');

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->actingAs($logistics)
                ->putJson('/api/v1/logistics/account/password', [
                    'current_password' => 'wrong-password',
                    'password' => 'UpdatedLogistics456',
                    'password_confirmation' => 'UpdatedLogistics456',
                ])
                ->assertUnprocessable();
        }

        $this->putJson('/api/v1/logistics/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedLogistics456',
            'password_confirmation' => 'UpdatedLogistics456',
        ])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    public function test_logistics_can_upload_replace_view_and_remove_a_private_profile_photo(): void
    {
        $logistics = $this->logistics();

        $firstResponse = $this->actingAs($logistics)
            ->post('/api/v1/logistics/account/profile-photo', [
                'photo' => $this->image('avatar.png'),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Profile photo updated successfully.')
            ->assertJsonPath('account.security.profile_photo_editable', true);

        $url = (string) $firstResponse->json('account.profile.profile_photo_url');
        $this->assertStringStartsWith('/api/v1/logistics/account/profile-photo?v=', $url);
        $encoded = json_encode($firstResponse->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('logistics-profile-photos/', $encoded);
        $this->assertStringNotContainsString('logistics-profile-test', $encoded);

        $profile = $logistics->logisticsProfile->fresh();
        $this->assertSame('logistics-profile-test', $profile->profile_photo_disk);
        $this->assertSame('image/png', $profile->profile_photo_mime);
        $this->assertSame(1, $profile->profile_photo_width);
        $this->assertSame(1, $profile->profile_photo_height);
        $this->assertMatchesRegularExpression(
            '#^logistics-profile-photos/'.preg_quote($logistics->id, '#').'/[0-9a-f-]+\.png$#',
            $profile->profile_photo_path,
        );
        Storage::disk('logistics-profile-test')->assertExists($profile->profile_photo_path);
        $oldPath = $profile->profile_photo_path;

        $this->get('/api/v1/logistics/account/profile-photo')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => $this->image('replacement.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $replacementPath = $profile->fresh()->profile_photo_path;
        $this->assertNotSame($oldPath, $replacementPath);
        Storage::disk('logistics-profile-test')->assertMissing($oldPath);
        Storage::disk('logistics-profile-test')->assertExists($replacementPath);

        $this->deleteJson('/api/v1/logistics/account/profile-photo')
            ->assertOk()
            ->assertJsonPath('account.profile.profile_photo_url', null);
        Storage::disk('logistics-profile-test')->assertMissing($replacementPath);
        $this->assertDatabaseHas('logistics_profiles', [
            'user_id' => $logistics->id,
            'profile_photo_disk' => null,
            'profile_photo_path' => null,
            'profile_photo_mime' => null,
            'profile_photo_size' => null,
            'profile_photo_width' => null,
            'profile_photo_height' => null,
        ]);
        $this->get('/api/v1/logistics/account/profile-photo')->assertNotFound();
        $this->deleteJson('/api/v1/logistics/account/profile-photo')->assertOk();
    }

    public function test_profile_photo_is_private_to_the_authenticated_active_logistics_account(): void
    {
        $owner = $this->logistics();
        $other = $this->logistics('other-logistics@example.com');

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => $this->image('guest.png'),
        ], ['Accept' => 'application/json'])->assertUnauthorized();

        $this->actingAs($owner)->post('/api/v1/logistics/account/profile-photo', [
            'photo' => $this->image('owner.png'),
        ], ['Accept' => 'application/json'])->assertOk();
        $ownerPath = $owner->logisticsProfile->fresh()->profile_photo_path;

        $this->actingAs($other)->get('/api/v1/logistics/account/profile-photo')->assertNotFound();
        $other->update(['status' => UserStatus::Suspended]);
        $this->actingAs($other)->get('/api/v1/logistics/account/profile-photo')->assertForbidden();
        Storage::disk('logistics-profile-test')->assertExists($ownerPath);
    }

    public function test_profile_photo_rejects_corrupt_spoofed_double_extension_and_size_boundary_files(): void
    {
        $logistics = $this->logistics();
        $this->actingAs($logistics);

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('avatar.png', 'not-an-image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => $this->image('avatar.safe.png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => $this->image('avatar.jpg'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => UploadedFile::fake()->create('avatar.png', 10 * 1024, 'image/png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => $this->image('valid.png'),
            'user_id' => User::factory()->create()->id,
            'profile_photo_disk' => 'azure',
            'profile_photo_path' => 'forged/path.png',
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'profile_photo_disk', 'profile_photo_path']);

        $this->assertDatabaseMissing('logistics_profiles', [
            'user_id' => $logistics->id,
            'profile_photo_disk' => 'logistics-profile-test',
        ]);
    }

    public function test_profile_photo_accepts_valid_formats_and_the_strict_under_limit_boundary(): void
    {
        $logistics = $this->logistics();
        $this->actingAs($logistics);

        foreach ([
            ['avatar.jpeg', $this->jpegBytes(), 'image/jpeg'],
            ['avatar.png', $this->imageBytes(), 'image/png'],
            ['avatar.webp', $this->webpBytes(), 'image/webp'],
        ] as [$name, $bytes, $mime]) {
            $this->post('/api/v1/logistics/account/profile-photo', [
                'photo' => UploadedFile::fake()->createWithContent($name, $bytes),
            ], ['Accept' => 'application/json'])->assertOk();

            $this->assertSame($mime, $logistics->logisticsProfile->fresh()->profile_photo_mime);
        }

        $image = $this->imageBytes();
        $image .= str_repeat("\0", (10 * 1024 * 1024) - strlen($image) - 1);
        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('boundary.png', $image),
        ], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame((10 * 1024 * 1024) - 1, $logistics->logisticsProfile->fresh()->profile_photo_size);
    }

    public function test_profile_photo_upload_is_rate_limited(): void
    {
        $logistics = $this->logistics();
        $this->actingAs($logistics);

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->post('/api/v1/logistics/account/profile-photo', [
                'photo' => $this->image("avatar-{$attempt}.png"),
            ], ['Accept' => 'application/json'])->assertOk();
        }

        $this->post('/api/v1/logistics/account/profile-photo', [
            'photo' => $this->image('limited.png'),
        ], ['Accept' => 'application/json'])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    private function logistics(string $email = 'logistics@example.com', UserStatus $status = UserStatus::Active): User
    {
        $user = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Logistics,
            'status' => $status,
            'password' => 'CurrentLogistics123',
        ]);
        $user->logisticsProfile()->create([
            'first_name' => 'Logan',
            'last_name' => 'Operator',
            'middle_name' => 'A',
            'contact_number' => '09171234567',
            'sex' => UserSex::Male,
            'birth_date' => '1990-01-01',
        ]);
        $address = $user->addresses()->create([
            'type' => AddressType::Both,
            'label' => 'Operational hub/sorting-center address',
            'recipient_name' => 'Logan Operator',
            'contact_number' => '09171234567',
            'address_line_1' => '1 Hub Road',
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region',
            'postal_code' => '1200',
            'country' => 'Philippines',
            'is_default' => true,
        ]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Delivery Services']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley operational hub']);

        return $user;
    }

    private function image(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $this->imageBytes());
    }

    private function imageBytes(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        );
    }

    private function jpegBytes(): string
    {
        return base64_decode(
            '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=',
            true,
        );
    }

    private function webpBytes(): string
    {
        return base64_decode(
            'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
            true,
        );
    }
}
