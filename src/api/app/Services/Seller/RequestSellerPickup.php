<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserStatus;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\FinancialHold;
use App\Models\LogisticsHub;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\Order;
use App\Models\SellerPickupRequest;
use App\Models\Shop;
use App\Models\User;
use App\Services\Logistics\EligibleLogisticsQuery;
use App\Services\Logistics\LogisticsNotificationService;
use App\Services\Logistics\SortingPlanService;
use App\Services\OrderTransitionService;
use App\Services\Waybills\CreateWaybill;
use Illuminate\Support\Facades\DB;

class RequestSellerPickup
{
    public function __construct(
        private readonly OrderTransitionService $transitions,
        private readonly SellerOrderInventory $inventory,
        private readonly EligibleLogisticsQuery $eligibleLogistics,
        private readonly SortingPlanService $sortingPlans,
        private readonly CreateWaybill $createWaybill,
        private readonly LogisticsNotificationService $notifications,
    ) {}

    public function handle(User $seller, array $orderIds, string $pickupAddressId, string $logisticsOrganizationId, string $key): SellerPickupRequest
    {
        $previous = SellerPickupRequest::query()->where('seller_id', $seller->id)->where('idempotency_key', $key)->with(['orders', 'waybills'])->first();
        if ($previous) {
            return $this->existing($previous, $orderIds, $pickupAddressId, $logisticsOrganizationId);
        }
        $quotedOrders = Order::query()->whereHas('shop', fn ($query) => $query->where('seller_id', $seller->id))
            ->whereIn('id', $orderIds)->with('pricingSnapshot')->get();
        if ($quotedOrders->count() === count($orderIds)) {
            $snapshotOrders = $quotedOrders->filter(fn (Order $order) => $order->pricingSnapshot !== null);
            $currentlyEligible = $snapshotOrders->mapWithKeys(function (Order $order) {
                $snapshot = $order->pricingSnapshot;

                return [$order->id => LogisticsShippingRateAcceptance::query()
                    ->where('shipping_rate_version_id', $snapshot->shipping_rate_version_id)->whereNull('revoked_at')
                    ->whereIn('logistics_organization_id', $snapshot->eligible_logistics_organization_ids)->pluck('logistics_organization_id')];
            });
            if ($currentlyEligible->contains(fn ($ids) => $ids->isEmpty())) {
                foreach ($snapshotOrders->whereIn('id', $currentlyEligible->filter(fn ($ids) => $ids->isEmpty())->keys()) as $order) {
                    FinancialHold::query()->firstOrCreate(
                        ['order_id' => $order->id, 'reason_code' => 'NO_QUOTED_PARTNER_AVAILABLE', 'released_at' => null],
                        ['placed_at' => now(), 'notes' => 'No Logistics partner can currently honor the saved shipping quote.'],
                    );
                }
                throw SellerOrderException::conflict('QUOTED_LOGISTICS_UNAVAILABLE', 'Fulfillment is on hold because no Logistics partner can honor the saved quote. The Customer price remains unchanged.');
            }
            if ($currentlyEligible->contains(fn ($ids) => ! $ids->contains($logisticsOrganizationId))) {
                throw SellerOrderException::conflict('LOGISTICS_RATE_NOT_ACCEPTED', 'Select a Logistics organization that honors every selected Order quote.');
            }
        }
        $eligible = $this->eligibleLogistics->forSeller($seller->id);
        $provider = $eligible['options']->firstWhere('id', $logisticsOrganizationId);
        if (! $provider || ! $provider['available']) {
            throw SellerOrderException::conflict('LOGISTICS_PROVIDER_UNAVAILABLE', 'The selected Logistics organization is no longer eligible.');
        }

        return DB::transaction(function () use ($seller, $orderIds, $pickupAddressId, $logisticsOrganizationId, $key, $provider): SellerPickupRequest {
            $shop = Shop::query()->where('seller_id', $seller->id)->lockForUpdate()->firstOrFail();
            $previous = SellerPickupRequest::query()->where('seller_id', $seller->id)->where('idempotency_key', $key)->with(['orders', 'waybills'])->first();
            if ($previous) {
                return $this->existing($previous, $orderIds, $pickupAddressId, $logisticsOrganizationId);
            }
            $stillEligible = LogisticsOrganization::query()->whereKey($provider['id'])
                ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
                ->whereHas('hub', fn ($query) => $query->whereKey($provider['hub']['id']))->lockForUpdate()->exists();
            if (! $stillEligible) {
                throw SellerOrderException::conflict('LOGISTICS_PROVIDER_UNAVAILABLE', 'The selected Logistics organization is no longer eligible.');
            }
            LogisticsHub::query()->whereKey($provider['hub']['id'])->lockForUpdate()->firstOrFail();

            $orders = Order::query()->where('shop_id', $shop->id)->whereIn('id', $orderIds)->with('address')->orderBy('id')->lockForUpdate()->get();
            if ($orders->count() !== count($orderIds)) {
                throw SellerOrderException::conflict('PICKUP_ORDERS_INVALID', 'One or more selected Orders are unavailable.');
            }
            $pickupAddress = $seller->addresses()->whereKey($pickupAddressId)->lockForUpdate()->first();
            if (! $pickupAddress) {
                throw SellerOrderException::conflict('PICKUP_ADDRESS_INVALID', 'The selected pickup address is unavailable.');
            }
            if ($orders->contains(fn (Order $order) => $order->status !== OrderStatus::SellerProcessing)) {
                throw SellerOrderException::conflict('PICKUP_ORDERS_INVALID', 'Only processing Orders can be submitted for pickup.');
            }
            if ($shop->status !== ShopStatus::Active || $orders->contains(fn (Order $order) => $order->payment_method !== PaymentMethod::CashOnDelivery
                || $order->payment_status !== PaymentStatus::Pending || ! $order->items()->exists() || ! $order->address()->exists())) {
                throw SellerOrderException::conflict('PICKUP_ORDERS_INVALID', 'One or more selected Orders no longer meet the pickup requirements.');
            }
            foreach ($orders as $order) {
                $this->inventory->lockReservation($order, $shop);
            }

            $request = SellerPickupRequest::create([
                'shop_id' => $shop->id, 'seller_id' => $seller->id,
                'logistics_organization_id' => $provider['id'], 'logistics_hub_id' => $provider['hub']['id'],
                'status' => 'pending_logistics', 'idempotency_key' => $key,
                'provider_match_tier' => $provider['match_tier'], 'provider_distance_km' => $provider['distance_km'],
                'provider_distance_status' => $provider['status'], 'provider_distance_calculated_at' => $provider['calculated_at'],
                'provider_source_fingerprint' => $provider['source_fingerprint'], 'provider_destination_fingerprint' => $provider['destination_fingerprint'],
            ]);
            $ordersById = $orders->keyBy('id');
            foreach ($orderIds as $position => $orderId) {
                $order = $ordersById->get($orderId);
                $event = $this->transitions->transition($order, OrderStatus::SellerProcessing, OrderStatus::ReadyForPickup, 'seller_pickup_request');
                $request->orders()->create(['order_id' => $order->id, 'pickup_address_id' => $pickupAddress->id, 'status_event_id' => $event->id, 'position' => $position]);
                $sorting = $this->sortingPlans->routingSnapshot($provider['id'], $provider['hub']['id'], $order->address?->postal_code);
                $this->createWaybill->handle($order, $request, $pickupAddress, $sorting);
            }

            $this->notifications->queuePickupRequested($request);

            return $request->load(['orders', 'waybills']);
        }, 3);
    }

    private function existing(SellerPickupRequest $previous, array $orderIds, string $pickupAddressId, string $logisticsOrganizationId): SellerPickupRequest
    {
        $committed = $previous->orders->pluck('order_id')->sort()->values()->all();
        $requested = collect($orderIds)->sort()->values()->all();
        $committedAddressIds = $previous->orders->pluck('pickup_address_id')->filter()->unique()->values();
        if ($committed !== $requested || $committedAddressIds->count() !== 1 || $committedAddressIds->first() !== $pickupAddressId || $previous->logistics_organization_id !== $logisticsOrganizationId) {
            throw SellerOrderException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another pickup request.');
        }

        return $previous;
    }
}
