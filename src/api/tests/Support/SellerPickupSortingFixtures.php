<?php

namespace Tests\Support;

use App\Enums\OrderStatus;
use App\Models\Permission;
use App\Models\SellerPickupRequest;
use App\Models\SortingPlan;
use App\Models\User;
use App\Services\Logistics\Sorting\SortingVersionService;
use App\Services\Seller\RequestSellerPickup;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

trait SellerPickupSortingFixtures
{
    use LocalSortingFixtures;

    private function pickupContext(): array
    {
        Http::preventStrayRequests();
        config(['hub-routing.enabled' => false, 'services.geoapify.server_key' => null]);
        Permission::firstOrCreate(['slug' => 'platform-settings.manage'], ['name' => 'Manage platform settings']);
        [$seller, $shop] = $this->sellerShop();
        [$logistics, $organization, $hub] = $this->logistics();
        $this->courier($organization->id, $hub->id);
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        $this->actingAs($logistics)->postJson('/api/v1/logistics/sorting/lanes', [
            'code' => 'EX', 'name' => 'Exceptions', 'type' => 'exception',
        ])->assertCreated();
        $first = $this->publishedPlan($logistics, 'First plan', 'LANE-1', true);
        $next = $this->publishedPlan($logistics, 'Next plan', 'LANE-5', false);

        return compact('seller', 'shop', 'logistics', 'organization', 'hub', 'order', 'first', 'next');
    }

    private function publishedPlan(User $logistics, string $name, string $code, bool $activate): array
    {
        $this->actingAs($logistics);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', [
            'code' => $code, 'name' => $code, 'type' => 'standard',
        ])->assertCreated()->json('data');
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => $name])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', [
            'expected_revision' => 1, 'lane_id' => $lane['id'], 'postal_code' => '6000',
        ])->assertOk();

        return $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/actions/publish', [
                'expected_revision' => 2, 'activate' => $activate,
            ])->assertOk()->json('data');
    }

    private function requestPickup(array $context, string $key): SellerPickupRequest
    {
        return app(RequestSellerPickup::class)->handle(
            $context['seller'], [$context['order']->id], $context['seller']->addresses()->sole()->id,
            $context['organization']->id, $key,
        );
    }

    private function activateNextPlan(array $context): void
    {
        app(SortingVersionService::class)->action(
            $context['logistics'], SortingPlan::findOrFail($context['next']['plan_id']), 'activate',
            ['expected_revision' => $context['next']['revision'], 'version_id' => $context['next']['version']['id']],
            (string) Str::uuid(),
        );
    }
}
