<?php

namespace App\Services\Messaging;

use App\Enums\CourierAffiliationStatus;
use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\ShipmentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CourierLogisticsAffiliation;
use App\Models\DeliveryTask;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Models\User;

class CourierCounterpartyEligibility
{
    /** @return array{order: Order, organization: LogisticsOrganization, courier_id: string, counterpart_id: string, shop_id: ?string} */
    public function resolve(DeliveryTask $task, string $counterpart, bool $lock = false): array
    {
        $shipmentQuery = $task->shipment();
        if ($lock) {
            $shipmentQuery->lockForUpdate();
        }
        $shipment = $shipmentQuery->firstOrFail();
        $orderQuery = Order::query()->whereKey($shipment->parcel?->order_id);
        if ($lock) {
            $orderQuery->lockForUpdate();
        }
        $order = $orderQuery->firstOrFail();
        $organizationId = $counterpart === 'seller'
            ? $shipment->logistics_organization_id : $shipment->current_logistics_organization_id;
        $hubId = $counterpart === 'seller' ? $shipment->logistics_hub_id : $shipment->current_hub_id;
        $organization = LogisticsOrganization::query()->with(['hub', 'user'])->findOrFail($organizationId);

        abort_unless($organization->hub?->id === $hubId
            && $organization->user?->status === UserStatus::Active
            && $task->courier_id, 404);
        $affiliation = CourierLogisticsAffiliation::query()
            ->where('courier_id', $task->courier_id)
            ->where('logistics_organization_id', $organization->id)
            ->where('logistics_hub_id', $hubId)
            ->where('status', CourierAffiliationStatus::Approved->value)
            ->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active->value));
        if ($lock) {
            $affiliation->lockForUpdate();
        }
        abort_unless($affiliation->first(), 404);

        if ($counterpart === 'seller') {
            abort_unless($task->leg === FulfillmentTaskLeg::FirstMile, 404);
            $legacyQuery = $task->legacyFirstMileTask()->with('schedule');
            if ($lock) {
                $legacyQuery->lockForUpdate();
            }
            $legacy = $legacyQuery->first();
            $shop = $order->shop()->with('seller')->first();
            abort_unless($legacy && $legacy->order_id === $order->id
                && $legacy->courier_id === $task->courier_id
                && $legacy->logistics_organization_id === $organization->id
                && $legacy->logistics_hub_id === $hubId
                && $legacy->waybill_id === $order->waybill?->id
                && $order->waybill?->logistics_organization_id === $organization->id
                && $order->status === OrderStatus::ReadyForPickup
                && $shop?->seller_id && $shop->status === ShopStatus::Active
                && $shop->seller?->status === UserStatus::Active, 404);
            if ($legacy->status !== FirstMileTaskStatus::Accepted
                || $legacy->schedule?->status?->value !== 'scheduled'
                || $task->status !== FulfillmentTaskStatus::SellerPickupAccepted) {
                throw FulfillmentException::conflict('TASK_NOT_ACTIVE', 'This task is no longer available for messaging.');
            }

            return ['order' => $order, 'organization' => $organization, 'courier_id' => $task->courier_id,
                'counterpart_id' => $shop->seller_id, 'shop_id' => $shop->id];
        }

        abort_unless($counterpart === 'customer' && $task->leg === FulfillmentTaskLeg::FinalMile
            && $order->customer?->status === UserStatus::Active, 404);
        $offerQuery = $task->offers()->where('courier_id', $task->courier_id)->orderByDesc('sequence');
        if ($lock) {
            $offerQuery->lockForUpdate();
        }
        $offer = $offerQuery->first();
        if (! in_array($task->status, [FulfillmentTaskStatus::DeliveryAccepted,
            FulfillmentTaskStatus::PickedUpFromHub, FulfillmentTaskStatus::InTransit,
            FulfillmentTaskStatus::OutForDelivery], true)
            || $offer?->status !== FulfillmentOfferStatus::Accepted
            || $offer?->logistics_organization_id !== $organization->id
            || $shipment->status === ShipmentStatus::InTransfer
            || ! in_array($order->status, [OrderStatus::Assigned, OrderStatus::PickedUp,
                OrderStatus::InTransit, OrderStatus::OutForDelivery], true)) {
            throw FulfillmentException::conflict('TASK_NOT_ACTIVE', 'This task is no longer available for messaging.');
        }

        return ['order' => $order, 'organization' => $organization, 'courier_id' => $task->courier_id,
            'counterpart_id' => $order->customer_id, 'shop_id' => null];
    }

    public function courierAffiliation(User $actor): CourierLogisticsAffiliation
    {
        return $actor->courierLogisticsAffiliation()->where('status', CourierAffiliationStatus::Approved->value)
            ->whereHas('organization.hub')->firstOrFail();
    }
}
