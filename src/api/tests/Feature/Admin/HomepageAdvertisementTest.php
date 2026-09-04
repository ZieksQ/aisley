<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HomepageAdvertisementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_publish_optional_content_and_unscheduled_single_ad(): void
    {
        $admin = $this->admin();
        $draft = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/homepage-advertisements', [
            'layout' => 'single',
            'rotation_interval_seconds' => 6,
            'ads' => [$this->ad(['title' => null, 'alt_text' => null, 'destination_url' => null])],
        ])->assertCreated()
            ->assertJsonPath('data.ads.0.title', null)
            ->assertJsonPath('data.ads.0.starts_at', null)
            ->assertJsonPath('data.ads.0.ends_at', null);

        $this->getJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$draft->json('data.id'))
            ->assertOk()
            ->assertJsonPath('data.layout', 'single');

        $this->postJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$draft->json('data.id').'/publish', [
            'revision' => 1,
        ])->assertOk();

        $this->getJson('/api/v1/customer/home?limit=20')->assertOk()
            ->assertJsonPath('advertisementLayer.layout', 'single')
            ->assertJsonPath('advertisementLayer.primary.0.title', null)
            ->assertJsonPath('advertisementLayer.primary.0.destinationUrl', null);

        $this->assertDatabaseHas('homepage_campaigns', [
            'title' => null,
            'alt_text' => null,
            'destination_url' => null,
            'starts_at' => null,
            'ends_at' => null,
        ]);
    }

    public function test_multi_block_carousel_uses_order_and_per_ad_schedule_fallbacks(): void
    {
        $admin = $this->admin();
        $draft = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/homepage-advertisements', [
            'layout' => 'multi_block_carousel',
            'rotation_interval_seconds' => 9,
            'ads' => [
                $this->ad(['title' => 'First slide', 'position' => 0]),
                $this->ad(['title' => 'Future slide', 'position' => 1, 'starts_at' => now()->addDay()->toIso8601String()]),
                $this->ad(['title' => 'Top block', 'slot' => 'secondary_top', 'position' => 2]),
                $this->ad(['title' => 'Expired bottom', 'slot' => 'secondary_bottom', 'position' => 3, 'ends_at' => now()->subMinute()->toIso8601String()]),
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$draft->json('data.id').'/publish', [
            'revision' => 1,
        ])->assertOk();

        $this->getJson('/api/v1/customer/home?limit=20')->assertOk()
            ->assertJsonPath('advertisementLayer.layout', 'multi_block_carousel')
            ->assertJsonPath('advertisementLayer.rotationIntervalSeconds', 9)
            ->assertJsonCount(1, 'advertisementLayer.primary')
            ->assertJsonPath('advertisementLayer.primary.0.title', 'First slide')
            ->assertJsonPath('advertisementLayer.secondaryTop.title', 'Top block')
            ->assertJsonPath('advertisementLayer.secondaryBottom.id', 'default-secondary_bottom');
    }

    public function test_publish_rejects_duplicate_or_missing_multi_block_slots(): void
    {
        $admin = $this->admin();
        $draft = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/homepage-advertisements', [
            'layout' => 'multi_block',
            'rotation_interval_seconds' => 6,
            'ads' => [
                $this->ad(),
                $this->ad(['slot' => 'secondary_top', 'position' => 1]),
                $this->ad(['slot' => 'secondary_top', 'position' => 2]),
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/admin/platform-settings/homepage-advertisements/'.$draft->json('data.id').'/publish', [
            'revision' => 1,
        ])->assertUnprocessable();
    }

    private function ad(array $overrides = []): array
    {
        return [...[
            'slot' => 'primary',
            'position' => 0,
            'title' => 'Advertisement',
            'description' => null,
            'image_desktop_path' => 'https://cdn.example.test/homepage-ad.jpg',
            'image_mobile_path' => null,
            'alt_text' => 'Advertisement',
            'destination_url' => null,
            'starts_at' => null,
            'ends_at' => null,
            'is_active' => true,
        ], ...$overrides];
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
