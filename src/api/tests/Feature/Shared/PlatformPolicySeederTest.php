<?php

namespace Tests\Feature\Shared;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformPolicy;
use App\Models\User;
use Database\Seeders\PlatformPolicySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformPolicySeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_development_fixture_seeds_each_policy_once_and_sets_the_current_published_version(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);

        $this->seed(PlatformPolicySeeder::class);

        $this->assertDatabaseCount('platform_policies', 3);
        $this->assertDatabaseCount('platform_policy_versions', 3);

        foreach (PlatformPolicyType::cases() as $type) {
            $policy = PlatformPolicy::query()->where('type', $type)->firstOrFail();
            $version = $policy->currentVersion()->firstOrFail();

            $this->assertSame(1, $version->version);
            $this->assertSame(PlatformPolicyVersionStatus::Published, $version->status);
            $this->assertSame($admin->id, $version->created_by_admin_id);
            $this->assertSame($admin->id, $version->published_by_admin_id);
            $this->assertNotSame('', trim($version->content));
        }

        $terms = PlatformPolicy::query()->where('type', PlatformPolicyType::TermsOfService)->firstOrFail();
        $terms->currentVersion()->update(['content' => 'Manually edited development copy.']);

        $this->seed(PlatformPolicySeeder::class);

        $this->assertDatabaseCount('platform_policies', 3);
        $this->assertDatabaseCount('platform_policy_versions', 3);
        $this->assertSame('Manually edited development copy.', $terms->currentVersion()->firstOrFail()->content);
    }

    public function test_fixture_seeder_skips_cleanly_when_no_admin_exists(): void
    {
        $this->seed(PlatformPolicySeeder::class);

        $this->assertDatabaseCount('platform_policies', 0);
        $this->assertDatabaseCount('platform_policy_versions', 0);
    }

    public function test_fixture_seeder_does_not_insert_development_content_in_production(): void
    {
        $originalEnvironment = app()->environment();
        app()->detectEnvironment(fn (): string => 'production');

        try {
            app(PlatformPolicySeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn (): string => $originalEnvironment);
        }

        $this->assertDatabaseCount('platform_policies', 0);
        $this->assertDatabaseCount('platform_policy_versions', 0);
    }
}
