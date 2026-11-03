<?php

namespace Tests\Feature\Customer;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CustomerProfile;
use App\Models\User;
use App\Services\Customer\CustomerIdImageService;
use App\Services\Customer\ProfilePhoto\ImageRewriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Support\ProfilePhotoFixtures;
use Tests\TestCase;

class CustomerIdImageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('customer-id-image-test');
        config(['filesystems.default' => 'customer-id-image-test']);
    }

    public function test_customer_can_upload_read_and_remove_their_private_id_image(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);
        $bytes = ProfilePhotoFixtures::image('png');

        $response = $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('identity.png', $bytes),
        ], ['Accept' => 'application/json'])->assertOk();
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $imageUrl = $response->json('account.profile.idImageUrl');
        $this->assertIsString($imageUrl);
        $this->assertStringStartsWith('/api/v1/customer/account/id-image?v=', $imageUrl);

        $profile = $customer->customerProfile->fresh();
        $path = $profile->id_image_path;
        $this->assertSame('customer-id-image-test', $profile->id_image_disk);
        $this->assertStringStartsWith('customer-id-images/'.$customer->id.'/', $path);
        $this->assertSame('image/png', $profile->id_image_mime);
        $this->assertSame(strlen(Storage::disk('customer-id-image-test')->get($path)), $profile->id_image_size);
        $this->assertSame('private', Storage::disk('customer-id-image-test')->getVisibility($path));

        $previousPath = $path;
        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('identity.jpg', ProfilePhotoFixtures::image('jpg')),
        ], ['Accept' => 'application/json'])->assertOk();
        $profile = $customer->customerProfile->fresh();
        $path = $profile->id_image_path;
        $this->assertSame('image/jpeg', $profile->id_image_mime);
        Storage::disk('customer-id-image-test')->assertMissing($previousPath);

        $imageResponse = $this->get('/api/v1/customer/account/id-image', ['Accept' => 'image/png'])
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertStreamedContent(Storage::disk('customer-id-image-test')->get($path));
        $this->assertStringContainsString('private', $imageResponse->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', $imageResponse->headers->get('Cache-Control'));

        $this->delete('/api/v1/customer/account/id-image', ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('account.profile.idImageUrl', null);
        Storage::disk('customer-id-image-test')->assertMissing($path);
        $this->get('/api/v1/customer/account/id-image')->assertNotFound();
    }

    public function test_invalid_replacement_keeps_the_saved_image_and_foreign_roles_cannot_read_it(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);
        $this->post('/api/v1/customer/account/id-image', ['id_image' => $this->upload()], ['Accept' => 'application/json'])->assertOk();
        $profile = $customer->customerProfile->fresh();
        $savedPath = $profile->id_image_path;
        $savedBytes = Storage::disk('customer-id-image-test')->get($savedPath);

        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('fake.png', 'not an image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('id_image');
        $this->assertSame($savedPath, $profile->fresh()->id_image_path);
        $this->assertSame($savedBytes, Storage::disk('customer-id-image-test')->get($savedPath));

        $this->actingAs(User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]));
        $this->get('/api/v1/customer/account/id-image')->assertForbidden();
        $this->delete('/api/v1/customer/account/id-image')->assertForbidden();
    }

    public function test_mismatched_and_multiple_extensions_are_rejected(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);
        $bytes = ProfilePhotoFixtures::image('png');

        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('identity.jpg', $bytes),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('id_image');

        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('identity.jpg.png', $bytes),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('id_image');
        $this->assertSame([], Storage::disk('customer-id-image-test')->allFiles());
    }

    public function test_id_number_and_review_fields_are_prohibited(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);

        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => $this->upload(),
            'id_number' => 'SYNTHETIC-ID-NUMBER',
            'id_type' => 'government_id',
            'verification_status' => 'pending',
            'review_status' => 'pending',
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors([
            'id_number',
            'id_type',
            'verification_status',
            'review_status',
        ]);

        $this->assertSame([], Storage::disk('customer-id-image-test')->allFiles());
    }

    public function test_customer_can_upload_webp_id_image(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);

        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('identity.webp', ProfilePhotoFixtures::image('webp')),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame('image/webp', $customer->customerProfile->fresh()->id_image_mime);
    }

    public function test_guest_cannot_upload_or_read_an_id_image(): void
    {
        $this->post('/api/v1/customer/account/id-image', ['id_image' => $this->upload()], ['Accept' => 'application/json'])->assertUnauthorized();
        $this->get('/api/v1/customer/account/id-image', ['Accept' => 'application/json'])->assertUnauthorized();
    }

    public function test_upload_is_limited_per_customer_and_ip(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);
        $key = md5('customer-id-image'.implode('|', [
            'customer-id-image',
            $customer->getAuthIdentifier(),
            '127.0.0.1',
        ]));
        for ($attempt = 0; $attempt < 10; $attempt++) {
            RateLimiter::hit($key, 60);
        }

        $this->post('/api/v1/customer/account/id-image', ['id_image' => $this->upload()], ['Accept' => 'application/json'])
            ->assertTooManyRequests()
            ->assertHeader('Retry-After');
        $this->assertSame([], Storage::disk('customer-id-image-test')->allFiles());
    }

    public function test_exact_size_limit_is_rejected_on_the_id_image_field(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);
        $this->post('/api/v1/customer/account/id-image', ['id_image' => $this->upload()], ['Accept' => 'application/json'])->assertOk();
        $before = $customer->customerProfile->fresh()->getAttributes();
        $bytes = ProfilePhotoFixtures::image('png');
        $bytes .= str_repeat("\0", ImageRewriter::MAX_BYTES - strlen($bytes));

        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('identity.png', $bytes),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('id_image');

        $this->assertSame($before, $customer->customerProfile->fresh()->getAttributes());
        $this->assertCount(1, Storage::disk('customer-id-image-test')->allFiles());
    }

    public function test_oversized_image_dimensions_are_rejected_on_the_id_image_field(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);
        $this->post('/api/v1/customer/account/id-image', ['id_image' => $this->upload()], ['Accept' => 'application/json'])->assertOk();
        $before = $customer->customerProfile->fresh()->getAttributes();

        $this->post('/api/v1/customer/account/id-image', [
            'id_image' => UploadedFile::fake()->createWithContent('identity.png', ProfilePhotoFixtures::pngHeader(8001, 1)),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('id_image');

        $this->assertSame($before, $customer->customerProfile->fresh()->getAttributes());
        $this->assertCount(1, Storage::disk('customer-id-image-test')->allFiles());
    }

    public function test_failed_database_replacement_preserves_the_saved_image_and_cleans_new_object(): void
    {
        $customer = $this->customer();
        $this->actingAs($customer);
        $this->post('/api/v1/customer/account/id-image', ['id_image' => $this->upload()], ['Accept' => 'application/json'])->assertOk();
        $before = $customer->customerProfile->fresh()->getAttributes();
        $dispatcher = CustomerProfile::getEventDispatcher();
        CustomerProfile::setEventDispatcher(clone $dispatcher);
        CustomerProfile::updating(function (): never {
            throw new RuntimeException('Simulated database failure.');
        });

        try {
            app(CustomerIdImageService::class)->upload($customer, $this->upload(), []);
            $this->fail('The ID image replacement should fail when metadata cannot be saved.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated database failure.', $exception->getMessage());
        } finally {
            CustomerProfile::setEventDispatcher($dispatcher);
        }

        $this->assertSame($before, $customer->customerProfile->fresh()->getAttributes());
        $this->assertSame([$before['id_image_path']], Storage::disk('customer-id-image-test')->allFiles());
    }

    public function test_publicly_visible_disk_is_rejected_for_id_images(): void
    {
        $customer = $this->customer();
        Storage::fake('customer-id-image-public-test');
        config([
            'filesystems.default' => 'customer-id-image-public-test',
            'filesystems.disks.customer-id-image-public-test.visibility' => 'public',
        ]);

        try {
            app(CustomerIdImageService::class)->upload($customer, $this->upload(), []);
            $this->fail('A publicly visible disk must not store an ID image.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Private ID image storage is not configured.', $exception->getMessage());
        }

        $this->assertSame([], Storage::disk('customer-id-image-public-test')->allFiles());
    }

    public function test_public_disk_name_is_rejected_even_when_visibility_is_misconfigured(): void
    {
        $customer = $this->customer();
        Storage::fake('public');
        config([
            'filesystems.default' => 'public',
            'filesystems.disks.public.visibility' => null,
            'filesystems.disks.public.is_public_container' => false,
        ]);

        try {
            app(CustomerIdImageService::class)->upload($customer, $this->upload(), []);
            $this->fail('A disk configured as public must not store an ID image.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Private ID image storage is not configured.', $exception->getMessage());
        }

        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    private function customer(): User
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        CustomerProfile::create([
            'user_id' => $customer->id,
            'first_name' => 'ID',
            'last_name' => 'Owner',
            'contact_number' => '+639171234567',
            'birth_date' => '2000-01-01',
            'sex' => 'prefer_not_to_say',
        ]);

        return $customer;
    }

    private function upload(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('identity.png', ProfilePhotoFixtures::image('png'));
    }
}
