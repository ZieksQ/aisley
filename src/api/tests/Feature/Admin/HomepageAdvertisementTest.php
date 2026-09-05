<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HomepageAdvertisementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['filesystems.default' => 'public']);
    }

    public function test_admin_can_upload_a_storage_backed_image_and_publish_an_image_only_tagged_advertisement(): void
    {
        Storage::fake('public');
        $admin = $this->admin();
        $image = $this->upload($admin, 'September sale.jpg');

        $this->assertSame('September sale.jpg', $image['filename']);
        Storage::disk('public')->assertExists($image['path']);

        $draft = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/homepage-advertisements', [
            'tag_title' => 'September homepage sale',
            'layout' => 'single',
            'rotation_interval_seconds' => 6,
            'starts_at' => null,
            'ends_at' => null,
            'ads' => [$this->ad($image)],
        ])->assertCreated()
            ->assertJsonPath('data.tag_title', 'September homepage sale')
            ->assertJsonPath('data.ads.0.image_desktop_filename', 'September sale.jpg');

        $this->assertArrayNotHasKey('title', $draft->json('data.ads.0'));
        $this->assertArrayNotHasKey('description', $draft->json('data.ads.0'));
        $this->assertArrayNotHasKey('alt_text', $draft->json('data.ads.0'));
        $this->assertArrayNotHasKey('starts_at', $draft->json('data.ads.0'));

        $this->postJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$draft->json('data.id').'/publish', [
            'revision' => 1,
        ])->assertOk();

        $this->getJson('/api/v1/customer/home?limit=20')->assertOk()
            ->assertJsonPath('advertisementLayer.layout', 'single')
            ->assertJsonPath('advertisementLayer.primary.0.title', null)
            ->assertJsonPath('advertisementLayer.primary.0.description', null)
            ->assertJsonPath('advertisementLayer.primary.0.altText', null)
            ->assertJsonPath('advertisementLayer.primary.0.imageDesktopUrl', Storage::disk('public')->url($image['path']));

        $this->assertDatabaseHas('homepage_campaigns', [
            'image_desktop_path' => $image['path'],
            'image_desktop_filename' => 'September sale.jpg',
            'title' => null,
            'alt_text' => null,
            'starts_at' => null,
            'ends_at' => null,
        ]);
    }

    public function test_advertisement_schedule_controls_the_complete_layout(): void
    {
        Storage::fake('public');
        $admin = $this->admin();
        $image = $this->upload($admin, 'scheduled.png');
        $startsAt = now()->addHour()->startOfMinute();
        $endsAt = now()->addDay()->startOfMinute();

        $draft = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/homepage-advertisements', [
            'tag_title' => 'Tomorrow promotion',
            'layout' => 'carousel',
            'rotation_interval_seconds' => 9,
            'starts_at' => $startsAt->toIso8601String(),
            'ends_at' => $endsAt->toIso8601String(),
            'ads' => [
                $this->ad($image),
                $this->ad($image, ['position' => 1]),
            ],
        ])->assertCreated()
            ->assertJsonPath('data.tag_title', 'Tomorrow promotion');

        $this->postJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$draft->json('data.id').'/publish', ['revision' => 1])->assertOk();

        $this->getJson('/api/v1/customer/home?limit=20')->assertOk()
            ->assertJsonPath('advertisementLayer', null);

        $this->travelTo($startsAt->copy()->addMinute());
        $this->getJson('/api/v1/customer/home?limit=20')->assertOk()
            ->assertJsonPath('advertisementLayer.layout', 'carousel')
            ->assertJsonPath('advertisementLayer.rotationIntervalSeconds', 9)
            ->assertJsonCount(2, 'advertisementLayer.primary');
    }

    public function test_advertisement_creation_rejects_an_image_url_not_saved_in_advertisement_storage(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/homepage-advertisements', [
            'tag_title' => 'Invalid image source',
            'layout' => 'single',
            'rotation_interval_seconds' => 6,
            'ads' => [$this->ad(['path' => 'https://cdn.example.test/homepage-ad.jpg', 'filename' => 'homepage-ad.jpg'])],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['ads.0.image_desktop_path']);
    }

    public function test_archived_advertisements_can_be_removed_after_a_replacement_is_published(): void
    {
        Storage::fake('public');
        $admin = $this->admin();
        $image = $this->upload($admin, 'archive.jpg');
        $first = $this->createDraft($admin, 'Original sale', $image);
        $this->postJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$first.'/publish', ['revision' => 1])->assertOk();

        $second = $this->createDraft($admin, 'Replacement sale', $image);
        $this->postJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$second.'/publish', ['revision' => 1])->assertOk();

        $this->assertDatabaseHas('homepage_advertisement_configurations', ['id' => $first, 'status' => 'archived']);
        $this->deleteJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$first, ['revision' => 2])->assertNoContent();
        $this->assertDatabaseMissing('homepage_advertisement_configurations', ['id' => $first]);
        $this->assertDatabaseMissing('homepage_campaigns', ['homepage_advertisement_configuration_id' => $first]);
    }

    public function test_upload_accepts_valid_jpeg_and_uses_azure_when_configured(): void
    {
        config(['filesystems.default' => 'azure']);
        Storage::fake('azure');
        $admin = $this->admin();

        $image = $this->upload($admin, 'azure-banner.jpeg');

        $this->assertSame('azure-banner.jpeg', $image['filename']);
        Storage::disk('azure')->assertExists($image['path']);
    }

    public function test_upload_rejects_an_image_at_the_ten_mebibyte_limit(): void
    {
        Storage::fake('public');
        $admin = $this->admin();

        $this->actingAs($admin)->post('/api/v1/admin/platform-settings/homepage-advertisement-images', [
            'image' => UploadedFile::fake()->image('too-large.jpg')->size(10_240),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['image']);
    }

    /** @return array{path: string, filename: string} */
    private function upload(User $admin, string $filename): array
    {
        /** @var array{path: string, filename: string} $image */
        $image = $this->actingAs($admin)->post('/api/v1/admin/platform-settings/homepage-advertisement-images', [
            'image' => UploadedFile::fake()->image($filename, 2, 2),
        ])->assertCreated()->json('data');

        return $image;
    }

    /**
     * @param  array{path: string, filename: string}|array{path: string, filename: string, position?: int}  $image
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function ad(array $image, array $overrides = []): array
    {
        return [...[
            'slot' => 'primary',
            'position' => 0,
            'image_desktop_path' => $image['path'],
            'image_desktop_filename' => $image['filename'],
            'image_mobile_path' => null,
            'image_mobile_filename' => null,
            'destination_url' => null,
            'is_active' => true,
        ], ...$overrides];
    }

    /** @param array{path: string, filename: string} $image */
    private function createDraft(User $admin, string $tagTitle, array $image): string
    {
        return $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/homepage-advertisements', [
            'tag_title' => $tagTitle,
            'layout' => 'single',
            'rotation_interval_seconds' => 6,
            'ads' => [$this->ad($image)],
        ])->assertCreated()->json('data.id');
    }

    private function admin(): User
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        AdminProfile::create(['user_id' => $admin->id, 'first_name' => 'Avery', 'last_name' => 'Admin']);
        foreach (['platform-settings.view', 'platform-settings.manage'] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => str($slug)->headline()]);
            $admin->permissions()->syncWithoutDetaching($permission);
        }

        return $admin;
    }
}
