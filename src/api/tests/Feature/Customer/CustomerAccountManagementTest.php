<?php

namespace Tests\Feature\Customer;

use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\CustomerProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('customer-profile-test');
        config()->set('filesystems.default', 'customer-profile-test');
    }

    public function test_only_an_active_customer_can_read_the_private_account_resource(): void
    {
        $this->getJson('/api/v1/customer/account')->assertUnauthorized();

        $seller = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);
        Sanctum::actingAs($seller);
        $this->getJson('/api/v1/customer/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $pending = $this->customer(['status' => UserStatus::Pending]);
        Sanctum::actingAs($pending);
        $this->getJson('/api/v1/customer/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $customer = $this->customer(['email' => 'active@example.com']);
        Sanctum::actingAs($customer);
        $this->getJson('/api/v1/customer/account')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('account.id', $customer->id)
            ->assertJsonPath('account.email', 'active@example.com')
            ->assertJsonPath('account.role', UserRole::Customer->value)
            ->assertJsonPath('account.status', UserStatus::Active->value)
            ->assertJsonPath('account.profile.firstName', 'Aisley')
            ->assertJsonPath('account.profile.age', now()->year - 2000)
            ->assertJsonPath('account.profile.profilePhotoUrl', null)
            ->assertJsonMissingPath('account.password')
            ->assertJsonMissingPath('account.profile.profile_photo_path')
            ->assertJsonMissingPath('account.profile.profile_photo_disk');
    }

    public function test_customer_can_update_only_their_own_allow_listed_profile_fields(): void
    {
        $customer = $this->customer();
        $otherCustomer = $this->customer(['email' => 'other@example.com']);
        $sellerWithSameEmail = User::factory()->create([
            'email' => $customer->email,
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);

        $this->actingAs($customer)->patchJson('/api/v1/customer/account/profile', [
            'first_name' => '  Avery ',
            'middle_name' => '',
            'last_name' => ' Buyer ',
            'contact_number' => ' +639181234567 ',
            'sex' => UserSex::NonBinary->value,
            'birth_date' => '1998-06-15',
        ])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('account.profile.firstName', 'Avery')
            ->assertJsonPath('account.profile.middleName', null)
            ->assertJsonPath('account.profile.contactNumber', '+639181234567')
            ->assertJsonPath('customer.displayName', 'Avery Buyer');

        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $customer->id,
            'first_name' => 'Avery',
            'middle_name' => null,
            'contact_number' => '+639181234567',
        ]);
        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $otherCustomer->id,
            'first_name' => 'Aisley',
        ]);
        $this->assertSame($customer->email, $sellerWithSameEmail->fresh()->email);
    }

    public function test_profile_update_rejects_invalid_and_forbidden_fields_without_partial_changes(): void
    {
        $customer = $this->customer();

        $this->actingAs($customer)->patchJson('/api/v1/customer/account/profile', [
            'first_name' => 'Changed',
            'middle_name' => null,
            'last_name' => 'Buyer',
            'contact_number' => '+639181234567',
            'sex' => 'unknown',
            'birth_date' => now()->addDay()->toDateString(),
            'email' => 'forged@example.com',
            'role' => UserRole::Admin->value,
            'status' => UserStatus::Suspended->value,
            'user_id' => User::factory()->create()->id,
            'profile_photo_path' => 'private/file.png',
            'profile_photo_disk' => 'azure',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors([
                'sex',
                'birth_date',
                'email',
                'role',
                'status',
                'user_id',
                'profile_photo_path',
                'profile_photo_disk',
            ]);

        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $customer->id,
            'first_name' => 'Aisley',
        ]);
        $this->assertSame('customer@example.com', $customer->fresh()->email);
        $this->assertSame(UserStatus::Active, $customer->fresh()->status);
    }

    public function test_password_change_requires_current_confirmed_strong_password_and_revokes_other_tokens(): void
    {
        $customer = $this->customer(['password' => 'CurrentPassword1']);
        $customer->createToken('Phone');
        $customer->createToken('Tablet');

        $this->actingAs($customer)->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'weak',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Password updated successfully. Other app access tokens have been revoked.')
            ->assertJsonMissingPath('password');

        $this->assertTrue(Hash::check('UpdatedPassword2', $customer->fresh()->password));
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $customer->id]);
        $this->getJson('/api/v1/customer/account')->assertOk();

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'AnotherPassword3',
            'password_confirmation' => 'AnotherPassword3',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
    }

    public function test_token_authenticated_password_change_preserves_the_current_token_only(): void
    {
        $customer = $this->customer(['password' => 'CurrentPassword1']);
        $currentToken = $customer->createToken('Current phone');
        $otherToken = $customer->createToken('Old tablet');

        $this->withToken($currentToken->plainTextToken)->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertOk();

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $currentToken->accessToken->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $otherToken->accessToken->id]);
        $this->withToken($currentToken->plainTextToken)
            ->getJson('/api/v1/customer/account')
            ->assertOk();
    }

    public function test_password_change_is_rate_limited(): void
    {
        $customer = $this->customer(['password' => 'CurrentPassword1']);
        $this->actingAs($customer);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->patchJson('/api/v1/customer/account/password', [
                'current_password' => 'wrong-password',
                'password' => 'UpdatedPassword2',
                'password_confirmation' => 'UpdatedPassword2',
            ])->assertUnprocessable();
        }

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertTooManyRequests();
    }

    public function test_customer_can_upload_replace_view_and_remove_a_private_profile_photo(): void
    {
        $customer = $this->customer();

        $firstResponse = $this->actingAs($customer)->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('avatar.png'),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Profile photo updated successfully.')
            ->assertJsonPath('customer.avatarUrl', fn (mixed $value): bool => is_string($value)
                && str_starts_with($value, '/api/v1/customer/account/profile-photo?v='));

        $this->assertStringStartsWith(
            '/api/v1/customer/account/profile-photo?v=',
            (string) $firstResponse->json('account.profile.profilePhotoUrl'),
        );
        $encoded = json_encode($firstResponse->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('customer-profile-photos/', $encoded);
        $this->assertStringNotContainsString('customer-profile-test', $encoded);

        $profile = $customer->customerProfile->fresh();
        $this->assertSame('customer-profile-test', $profile->profile_photo_disk);
        $this->assertSame('image/png', $profile->profile_photo_mime);
        $this->assertSame(1, $profile->profile_photo_width);
        $this->assertSame(1, $profile->profile_photo_height);
        $this->assertMatchesRegularExpression(
            '#^customer-profile-photos/'.preg_quote($customer->id, '#').'/[0-9a-f-]+\.png$#',
            $profile->profile_photo_path,
        );
        Storage::disk('customer-profile-test')->assertExists($profile->profile_photo_path);
        $oldPath = $profile->profile_photo_path;

        $this->get('/api/v1/customer/account/profile-photo')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('replacement.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $replacementPath = $profile->fresh()->profile_photo_path;
        $this->assertNotSame($oldPath, $replacementPath);
        Storage::disk('customer-profile-test')->assertMissing($oldPath);
        Storage::disk('customer-profile-test')->assertExists($replacementPath);

        $this->deleteJson('/api/v1/customer/account/profile-photo')
            ->assertOk()
            ->assertJsonPath('account.profile.profilePhotoUrl', null)
            ->assertJsonPath('customer.avatarUrl', null);
        Storage::disk('customer-profile-test')->assertMissing($replacementPath);
        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $customer->id,
            'profile_photo_disk' => null,
            'profile_photo_path' => null,
            'profile_photo_mime' => null,
            'profile_photo_size' => null,
            'profile_photo_width' => null,
            'profile_photo_height' => null,
        ]);
        $this->get('/api/v1/customer/account/profile-photo')->assertNotFound();
    }

    public function test_profile_photo_is_owner_only_and_requires_an_active_customer(): void
    {
        $owner = $this->customer();
        $other = $this->customer(['email' => 'other@example.com']);

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('guest.png'),
        ], ['Accept' => 'application/json'])->assertUnauthorized();

        $this->actingAs($owner)->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('owner.png'),
        ], ['Accept' => 'application/json'])->assertOk();
        $ownerPath = $owner->customerProfile->fresh()->profile_photo_path;

        $this->actingAs($other)->get('/api/v1/customer/account/profile-photo')->assertNotFound();
        $this->deleteJson('/api/v1/customer/account/profile-photo')->assertOk();
        Storage::disk('customer-profile-test')->assertExists($ownerPath);

        $this->actingAs($owner)->get('/api/v1/customer/account/profile-photo')->assertOk();

        $owner->update(['status' => UserStatus::Suspended]);
        $this->get('/api/v1/customer/account/profile-photo')->assertForbidden();
    }

    public function test_profile_photo_rejects_corrupt_spoofed_double_extension_and_size_boundary_files(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('avatar.png', 'not-an-image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('avatar.safe.png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('avatar.jpg'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => UploadedFile::fake()->create('avatar.png', 10 * 1024, 'image/png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('valid.png'),
            'user_id' => User::factory()->create()->id,
            'profile_photo_disk' => 'azure',
            'profile_photo_path' => 'forged/path.png',
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'profile_photo_disk', 'profile_photo_path']);

        $this->assertDatabaseMissing('customer_profiles', [
            'user_id' => $customer->id,
            'profile_photo_disk' => 'customer-profile-test',
        ]);
    }

    public function test_profile_photo_accepts_a_valid_image_one_byte_below_the_limit(): void
    {
        $customer = $this->customer();
        $image = $this->imageBytes();
        $image .= str_repeat("\0", (10 * 1024 * 1024) - strlen($image) - 1);

        $this->actingAs($customer)->post('/api/v1/customer/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('boundary.png', $image),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame((10 * 1024 * 1024) - 1, $customer->customerProfile->fresh()->profile_photo_size);
    }

    public function test_profile_photo_accepts_each_approved_image_format(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);

        foreach ([
            ['avatar.jpeg', $this->jpegBytes(), 'image/jpeg'],
            ['avatar.png', $this->imageBytes(), 'image/png'],
            ['avatar.webp', $this->webpBytes(), 'image/webp'],
        ] as [$name, $bytes, $mime]) {
            $this->post('/api/v1/customer/account/profile-photo', [
                'photo' => UploadedFile::fake()->createWithContent($name, $bytes),
            ], ['Accept' => 'application/json'])->assertOk();

            $this->assertSame($mime, $customer->customerProfile->fresh()->profile_photo_mime);
        }
    }

    public function test_profile_photo_upload_is_rate_limited(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->post('/api/v1/customer/account/profile-photo', [
                'photo' => $this->image("avatar-{$attempt}.png"),
            ], ['Accept' => 'application/json'])->assertOk();
        }

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => $this->image('limited.png'),
        ], ['Accept' => 'application/json'])->assertTooManyRequests();
    }

    /** @param array<string, mixed> $overrides */
    private function customer(array $overrides = []): User
    {
        $customer = User::factory()->create(array_merge([
            'email' => 'customer@example.com',
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ], $overrides));

        CustomerProfile::create([
            'user_id' => $customer->id,
            'first_name' => 'Aisley',
            'middle_name' => 'Q',
            'last_name' => 'Buyer',
            'contact_number' => '+639171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '2000-01-01',
            'profile_photo_path' => 'customer-profile-photos/private.png',
        ]);

        return $customer;
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
