<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Models\SellerPickupRequest;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\Logistics\SellerPickupRequestedNotification;
use App\Services\Logistics\EligibleLogisticsQuery;
use App\Services\OrderTransitionService;
use App\Services\Waybills\CreateWaybill;
use Illuminate\Support\Facades\DB;

class RequestSellerPickup
{
    public function __construct(
        private readonly OrderTransitionService $transitions,
        private readonly SellerOrderInventory $inventory,
        private readonly EligibleLogisticsQuery $eligibleLogistics,
        private readonly CreateWaybill $createWaybill,
    ) {}

    public function handle(User $seller, array $orderIds, string $logisticsOrganizationId, string $key): SellerPickupRequest
    {
        $previous = SellerPickupRequest::query()->where('seller_id', $seller->id)->where('idempotency_key', $key)->with(['orders', 'waybills'])->first();
        if ($previous) {
            return $this->existing($previous, $orderIds, $logisticsOrganizationId);
        }
        $eligible = $this->eligibleLogistics->forSeller($seller->id);
        $provider = $eligible['options']->firstWhere('id', $logisticsOrganizationId);
        if (! $provider || ! $provider['available']) {
            throw SellerOrderException::conflict('LOGISTICS_PROVIDER_UNAVAILABLE', 'The selected Logistics organization is no longer eligible.');
        }

        return DB::transaction(function () use ($seller, $orderIds, $logisticsOrganizationId, $key, $eligible, $provider): SellerPickupRequest {
            $shop = Shop::query()->where('seller_id', $seller->id)->lockForUpdate()->firstOrFail();
            $previous = SellerPickupRequest::query()->where('seller_id', $seller->id)->where('idempotency_key', $key)->with(['orders', 'waybills'])->first();
            if ($previous) {
                return $this->existing($previous, $orderIds, $logisticsOrganizationId);
            }
            $stillEligible = LogisticsOrganization::query()->whereKey($provider['id'])
                ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
                ->whereHas('hub', fn ($query) => $query->whereKey($provider['hub']['id']))->lockForUpdate()->exists();
            if (! $stillEligible) {
                throw SellerOrderException::conflict('LOGISTICS_PROVIDER_UNAVAILABLE', 'The selected Logistics organization is no longer eligible.');
            }

            $orders = Order::query()->where('shop_id', $shop->id)->whereIn('id', $orderIds)->orderBy('id')->lockForUpdate()->get();
            if ($orders->count() !== count($orderIds)) {
                throw SellerOrderException::conflict('PICKUP_ORDERS_INVALID', 'One or more selected Orders are unavailable.');
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
                $request->orders()->create(['order_id' => $order->id, 'status_event_id' => $event->id, 'position' => $position]);
                $this->createWaybill->handle($order, $request, $eligible['address']);
            }

            DB::afterCommit(function () use ($request): void {
                try {
                    User::query()->where('role', UserRole::Logistics)->where('status', UserStatus::Active)
                        ->whereHas('logisticsOrganization', fn ($query) => $query->whereKey($request->logistics_organization_id))
                        ->first()?->notify(new SellerPickupRequestedNotification($request->loadMissing('orders')));
                } catch (\Throwable $exception) {
                    report($exception);
                }
            });

            return $request->load(['orders', 'waybills']);
        }, 3);
    }

    private function existing(SellerPickupRequest $previous, array $orderIds, string $logisticsOrganizationId): SellerPickupRequest
    {
        $committed = $previous->orders->pluck('order_id')->sort()->values()->all();
        $requested = collect($orderIds)->sort()->values()->all();
        if ($committed !== $requested || $previous->logistics_organization_id !== $logisticsOrganizationId) {
            throw SellerOrderException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another pickup request.');
        }

        return $previous;
    }
}
