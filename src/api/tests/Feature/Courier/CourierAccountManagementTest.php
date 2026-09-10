<?php

namespace Tests\Feature\Courier;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CourierAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('courier-profile-test');
        config()->set('filesystems.default', 'courier-profile-test');
    }

    public function test_only_an_active_approved_courier_can_read_their_private_account(): void
    {
        $this->getJson('/api/v1/courier/account')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)
            ->getJson('/api/v1/courier/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $courier = $this->courier();
        $this->actingAs($courier)
            ->getJson('/api/v1/courier/account')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertJsonPath('account.id', $courier->id)
            ->assertJsonPath('account.email', 'courier@example.com')
            ->assertJsonPath('account.role', 'courier')
            ->assertJsonPath('account.profile.first_name', 'Cora')
            ->assertJsonPath('account.profile.middle_name', null)
            ->assertJsonPath('account.profile.last_name', 'Rider')
            ->assertJsonPath('account.profile.contact_number', '09171234568')
            ->assertJsonPath('account.profile.sex', 'female')
            ->assertJsonPath('account.profile.birth_date', '1994-06-15')
            ->assertJsonPath('account.affiliation.status', 'approved')
            ->assertJsonPath('account.affiliation.organization_name', 'Aisley Delivery Services')
            ->assertJsonPath('account.affiliation.hub_name', 'Aisley operational hub')
            ->assertJsonPath('account.security.email_editable', false)
            ->assertJsonPath('account.security.profile_photo_editable', true)
            ->assertJsonPath('account.security.password_change_requires_current_password', true)
            ->assertJsonPath('account.profile.profile_photo_url', null)
            ->assertJsonMissingPath('account.password')
            ->assertJsonMissingPath('account.profile.profile_photo_path')
            ->assertJsonMissingPath('account.affiliation.reviewer_id');
    }

    public function test_pending_or_invalidly_affiliated_courier_cannot_read_or_update_account(): void
    {
        $pending = $this->courier('pending@example.com', UserStatus::Pending);
        $this->actingAs($pending)
            ->getJson('/api/v1/courier/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $invalid = $this->courier('invalid@example.com');
        $invalid->courierLogisticsAffiliation()->update(['status' => CourierAffiliationStatus::Pending]);

        $this->actingAs($invalid)
            ->patchJson('/api/v1/courier/account/profile', ['first_name' => 'Tampered'])
            ->assertForbidden()
            ->assertJsonPath('code', 'LOGISTICS_ASSOCIATION_INVALID');

        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $invalid->id,
            'first_name' => 'Cora',
        ]);
    }

    public function test_courier_can_update_only_their_allow_listed_profile_fields(): void
    {
        $courier = $this->courier();

        $this->actingAs($courier)
            ->patchJson('/api/v1/courier/account/profile', [
                'first_name' => 'Clara',
                'middle_name' => '  Q  ',
                'contact_number' => ' 09179999999 ',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('account.profile.first_name', 'Clara')
            ->assertJsonPath('account.profile.middle_name', 'Q')
            ->assertJsonPath('account.profile.last_name', 'Rider')
            ->assertJsonPath('account.profile.contact_number', '09179999999');

        $profile = $courier->courierProfile()->firstOrFail();
        $this->assertSame('Clara', $profile->first_name);
        $this->assertSame('Q', $profile->middle_name);
        $this->assertSame('Rider', $profile->last_name);
        $this->assertSame('09179999999', $profile->contact_number);
        $this->assertSame(UserSex::Female, $profile->sex);
        $this->assertSame('1994-06-15', $profile->birth_date?->toDateString());
    }

    public function test_profile_update_rejects_prohibited_and_unknown_fields_without_partial_writes(): void
    {
        $courier = $this->courier();

        $this->actingAs($courier)
            ->patchJson('/api/v1/courier/account/profile', [
                'first_name' => 'Tampered',
                'email' => 'changed@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->patchJson('/api/v1/courier/account/profile', [
            'last_name' => 'Tampered',
            'arbitrary_attribute' => 'not allowed',
        ])->assertUnprocessable()->assertJsonValidationErrors('arbitrary_attribute');

        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $courier->id,
            'first_name' => 'Cora',
            'last_name' => 'Rider',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $courier->id,
            'email' => 'courier@example.com',
        ]);
    }

    public function test_profile_update_normalizes_empty_middle_name_and_validates_invalid_values(): void
    {
        $courier = $this->courier();

        $this->actingAs($courier)
            ->patchJson('/api/v1/courier/account/profile', ['middle_name' => '   '])
            ->assertOk()
            ->assertJsonPath('account.profile.middle_name', null);

        $this->patchJson('/api/v1/courier/account/profile', ['first_name' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('first_name');

        $this->patchJson('/api/v1/courier/account/profile', ['contact_number' => str_repeat('1', 33)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('contact_number');
    }

    public function test_serialized_profile_writes_return_the_latest_projection_and_preserve_other_fields(): void
    {
        $courier = $this->courier();

        $this->actingAs($courier)
            ->patchJson('/api/v1/courier/account/profile', ['first_name' => 'First committed'])
            ->assertOk()
            ->assertJsonPath('account.profile.first_name', 'First committed')
            ->assertJsonPath('account.profile.last_name', 'Rider');

        $this->patchJson('/api/v1/courier/account/profile', ['last_name' => 'Second committed'])
            ->assertOk()
            ->assertJsonPath('account.profile.first_name', 'First committed')
            ->assertJsonPath('account.profile.last_name', 'Second committed');

        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $courier->id,
            'first_name' => 'First committed',
            'last_name' => 'Second committed',
        ]);
    }

    public function test_password_change_requires_current_password_and_revokes_every_token(): void
    {
        $courier = $this->courier();
        $first = $courier->createToken('phone');
        $second = $courier->createToken('tablet');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/courier/account/password', [
                'current_password' => 'wrong-password',
                'password' => 'UpdatedCourier456',
                'password_confirmation' => 'UpdatedCourier456',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/courier/account/password', [
                'current_password' => 'CurrentCourier123',
                'password' => 'UpdatedCourier456',
                'password_confirmation' => 'UpdatedCourier456',
            ])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Password updated successfully. All Courier access tokens have been revoked.')
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('token');

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertTrue(Hash::check('UpdatedCourier456', $courier->fresh()->password));
        $this->app['auth']->forgetGuards();
        $this->withToken($second->plainTextToken)
            ->getJson('/api/v1/courier/account')
            ->assertUnauthorized();
    }

    public function test_password_change_rejects_prohibited_fields_and_password_policy(): void
    {
        $courier = $this->courier();
        $this->actingAs($courier)
            ->putJson('/api/v1/courier/account/password', [
                'current_password' => 'CurrentCourier123',
                'password' => 'short',
                'password_confirmation' => 'short',
                'email' => 'tampered@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password', 'email']);

        $this->assertTrue(Hash::check('CurrentCourier123', $courier->fresh()->password));
    }

    public function test_password_change_is_throttled_per_courier_and_ip(): void
    {
        $courier = $this->courier();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->actingAs($courier)
                ->putJson('/api/v1/courier/account/password', [
                    'current_password' => 'wrong-password',
                    'password' => 'UpdatedCourier456',
                    'password_confirmation' => 'UpdatedCourier456',
                ])
                ->assertUnprocessable();
        }

        $this->putJson('/api/v1/courier/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedCourier456',
            'password_confirmation' => 'UpdatedCourier456',
        ])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    public function test_courier_can_upload_replace_view_and_remove_a_private_profile_photo(): void
    {
        $courier = $this->courier();

        $firstResponse = $this->actingAs($courier)
            ->post('/api/v1/courier/account/profile-photo', [
                'photo' => $this->image('avatar.png'),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Profile photo updated successfully.')
            ->assertJsonPath('account.security.profile_photo_editable', true);

        $url = (string) $firstResponse->json('account.profile.profile_photo_url');
        $this->assertStringStartsWith('/api/v1/courier/account/profile-photo?v=', $url);
        $encoded = json_encode($firstResponse->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('courier-profile-photos/', $encoded);
        $this->assertStringNotContainsString('courier-profile-test', $encoded);

        $profile = $courier->courierProfile->fresh();
        $this->assertSame('courier-profile-test', $profile->profile_photo_disk);
        $this->assertSame('image/png', $profile->profile_photo_mime);
        $this->assertSame(1, $profile->profile_photo_width);
        $this->assertSame(1, $profile->profile_photo_height);
        $this->assertMatchesRegularExpression(
            '#^courier-profile-photos/'.preg_quote($courier->id, '#').'/[0-9a-f-]+\.png$#',
            $profile->profile_photo_path,
        );
        Storage::disk('courier-profile-test')->assertExists($profile->profile_photo_path);
        $oldPath = $profile->profile_photo_path;

        $this->get('/api/v1/courier/account/profile-photo')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => $this->image('replacement.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $replacementPath = $profile->fresh()->profile_photo_path;
        $this->assertNotSame($oldPath, $replacementPath);
        Storage::disk('courier-profile-test')->assertMissing($oldPath);
        Storage::disk('courier-profile-test')->assertExists($replacementPath);

        $this->deleteJson('/api/v1/courier/account/profile-photo')
            ->assertOk()
            ->assertJsonPath('account.profile.profile_photo_url', null);
        Storage::disk('courier-profile-test')->assertMissing($replacementPath);
        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $courier->id,
            'profile_photo_disk' => null,
            'profile_photo_path' => null,
            'profile_photo_mime' => null,
            'profile_photo_size' => null,
            'profile_photo_width' => null,
            'profile_photo_height' => null,
        ]);
        $this->get('/api/v1/courier/account/profile-photo')->assertNotFound();
        $this->deleteJson('/api/v1/courier/account/profile-photo')->assertOk();
    }

    public function test_profile_photo_is_private_to_the_authenticated_active_courier(): void
    {
        $owner = $this->courier();
        $other = $this->courier('other-courier@example.com');

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => $this->image('guest.png'),
        ], ['Accept' => 'application/json'])->assertUnauthorized();

        $this->actingAs($owner)->post('/api/v1/courier/account/profile-photo', [
            'photo' => $this->image('owner.png'),
        ], ['Accept' => 'application/json'])->assertOk();
        $ownerPath = $owner->courierProfile->fresh()->profile_photo_path;

        $this->actingAs($other)->get('/api/v1/courier/account/profile-photo')->assertNotFound();
        $other->update(['status' => UserStatus::Suspended]);
        $this->actingAs($other)->get('/api/v1/courier/account/profile-photo')->assertForbidden();
        Storage::disk('courier-profile-test')->assertExists($ownerPath);
    }

    public function test_profile_photo_rejects_corrupt_spoofed_double_extension_and_size_boundary_files(): void
    {
        $courier = $this->courier();
        $this->actingAs($courier);

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('avatar.png', 'not-an-image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => $this->image('avatar.safe.png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => $this->image('avatar.jpg'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => UploadedFile::fake()->create('avatar.png', 10 * 1024, 'image/png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => $this->image('valid.png'),
            'user_id' => User::factory()->create()->id,
            'profile_photo_disk' => 'azure',
            'profile_photo_path' => 'forged/path.png',
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'profile_photo_disk', 'profile_photo_path']);

        $this->assertDatabaseMissing('courier_profiles', [
            'user_id' => $courier->id,
            'profile_photo_disk' => 'courier-profile-test',
        ]);
    }

    public function test_profile_photo_accepts_valid_formats_and_the_strict_under_limit_boundary(): void
    {
        $courier = $this->courier();
        $this->actingAs($courier);

        foreach ([
            ['avatar.jpeg', $this->jpegBytes(), 'image/jpeg'],
            ['avatar.png', $this->imageBytes(), 'image/png'],
            ['avatar.webp', $this->webpBytes(), 'image/webp'],
        ] as [$name, $bytes, $mime]) {
            $this->post('/api/v1/courier/account/profile-photo', [
                'photo' => UploadedFile::fake()->createWithContent($name, $bytes),
            ], ['Accept' => 'application/json'])->assertOk();

            $this->assertSame($mime, $courier->courierProfile->fresh()->profile_photo_mime);
        }

        $image = $this->imageBytes();
        $image .= str_repeat("\0", (10 * 1024 * 1024) - strlen($image) - 1);
        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('boundary.png', $image),
        ], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame((10 * 1024 * 1024) - 1, $courier->courierProfile->fresh()->profile_photo_size);
    }

    public function test_profile_photo_upload_is_rate_limited(): void
    {
        $courier = $this->courier();
        $this->actingAs($courier);

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->post('/api/v1/courier/account/profile-photo', [
                'photo' => $this->image("avatar-{$attempt}.png"),
            ], ['Accept' => 'application/json'])->assertOk();
        }

        $this->post('/api/v1/courier/account/profile-photo', [
            'photo' => $this->image('limited.png'),
        ], ['Accept' => 'application/json'])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    private function courier(string $email = 'courier@example.com', UserStatus $status = UserStatus::Active): User
    {
        $logistics = User::factory()->create([
            'email' => $email === 'courier@example.com' ? 'logistics@example.com' : 'logistics-'.$email,
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $logistics->logisticsProfile()->create([
            'first_name' => 'Logan',
            'last_name' => 'Operator',
            'contact_number' => '09171234567',
            'sex' => UserSex::Male,
            'birth_date' => '1990-01-01',
        ]);
        $address = $logistics->addresses()->create([
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
        $organization = $logistics->logisticsOrganization()->create([
            'business_name' => 'Aisley Delivery Services',
        ]);
        $hub = $organization->hub()->create([
            'address_id' => $address->id,
            'name' => 'Aisley operational hub',
        ]);

        $courier = User::factory()->create([
            'email' => $email,
            'password' => 'CurrentCourier123',
            'role' => UserRole::Courier,
            'status' => $status,
        ]);
        $courier->courierProfile()->create([
            'first_name' => 'Cora',
            'last_name' => 'Rider',
            'contact_number' => '09171234568',
            'sex' => UserSex::Female,
            'birth_date' => '1994-06-15',
        ]);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);

        return $courier;
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
