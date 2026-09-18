<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\LogisticsHub;
use App\Models\User;
use Database\Seeders\LuzonLogisticsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LuzonLogisticsSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_luzon_fixture_seeds_one_active_account_and_pinned_hub_per_region_idempotently(): void
    {
        $this->seed(LuzonLogisticsSeeder::class);

        $accounts = User::query()->where('role', UserRole::Logistics)->with(['logisticsProfile', 'logisticsOrganization.hub.address'])->get();

        $this->assertCount(8, $accounts);
        $this->assertSame(8, LogisticsHub::query()->count());
        $this->assertSame([
            'logistics.luzon01@example.com',
            'logistics.luzon02@example.com',
            'logistics.luzon03@example.com',
            'logistics.luzon04@example.com',
            'logistics.luzon05@example.com',
            'logistics.luzon06@example.com',
            'logistics.luzon07@example.com',
            'logistics.luzon08@example.com',
        ], $accounts->pluck('email')->sort()->values()->all());
        $this->assertSame([
            'Metro Manila',
            'Benguet',
            'La Union',
            'Cagayan',
            'Pampanga',
            'Laguna',
            'Oriental Mindoro',
            'Albay',
        ], $accounts->sortBy('email')->map(fn (User $account): string => $account->logisticsOrganization->hub->address->province)->values()->all());
        $this->assertTrue($accounts->every(fn (User $account): bool => $account->status === UserStatus::Active
            && Hash::check('logistics123', $account->password)
            && $account->logisticsProfile !== null
            && $account->logisticsOrganization?->hub?->address?->latitude !== null
            && $account->logisticsOrganization?->hub?->address?->longitude !== null,
        ));

        $this->seed(LuzonLogisticsSeeder::class);

        $this->assertSame(8, User::query()->where('role', UserRole::Logistics)->count());
        $this->assertSame(8, LogisticsHub::query()->count());
    }

    public function test_luzon_fixture_is_blocked_in_production(): void
    {
        $originalEnvironment = app()->environment();
        app()->detectEnvironment(fn (): string => 'production');

        try {
            app(LuzonLogisticsSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn (): string => $originalEnvironment);
        }

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('logistics_hubs', 0);
    }
}
