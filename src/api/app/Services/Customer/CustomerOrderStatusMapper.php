<?php

namespace App\Services\Customer;

use App\Enums\Customer\CustomerOrderGroup;
use App\Enums\OrderStatus;

class CustomerOrderStatusMapper
{
    /** @return list<OrderStatus> */
    public function statusesFor(CustomerOrderGroup $group): array
    {
        return match ($group) {
            CustomerOrderGroup::ToPay => [OrderStatus::PendingPayment],
            CustomerOrderGroup::ToPrepare => [
                OrderStatus::Placed,
                OrderStatus::SellerProcessing,
                OrderStatus::ReadyForPickup,
            ],
            CustomerOrderGroup::ToShip => [
                OrderStatus::Assigned,
                OrderStatus::PickedUp,
                OrderStatus::InTransit,
            ],
            CustomerOrderGroup::OutForDelivery => [OrderStatus::OutForDelivery],
            CustomerOrderGroup::Completed => [OrderStatus::Delivered],
            CustomerOrderGroup::CancelledIssue => [
                OrderStatus::Cancelled,
                OrderStatus::Rejected,
                OrderStatus::DeliveryFailed,
                OrderStatus::ReturnRequested,
                OrderStatus::Returned,
            ],
        };
    }

    public function groupFor(OrderStatus $status): CustomerOrderGroup
    {
        foreach (CustomerOrderGroup::cases() as $group) {
            if (in_array($status, $this->statusesFor($group), true)) {
                return $group;
            }
        }

        throw new \LogicException("Order status [{$status->value}] has no Customer group.");
    }

    public function groupLabel(CustomerOrderGroup $group): string
    {
        return match ($group) {
            CustomerOrderGroup::ToPay => 'To Pay',
            CustomerOrderGroup::ToPrepare => 'To Prepare',
            CustomerOrderGroup::ToShip => 'To Ship',
            CustomerOrderGroup::OutForDelivery => 'Out for Delivery',
            CustomerOrderGroup::Completed => 'Completed',
            CustomerOrderGroup::CancelledIssue => 'Cancelled / Issue',
        };
    }

    public function statusLabel(OrderStatus $status): string
    {
        return match ($status) {
            OrderStatus::PendingPayment => 'Payment pending',
            OrderStatus::Placed => 'Order placed',
            OrderStatus::SellerProcessing => 'Seller is preparing your order',
            OrderStatus::ReadyForPickup => 'Awaiting logistics handoff',
            OrderStatus::Assigned => 'Parcel received by logistics',
            OrderStatus::PickedUp => 'Parcel picked up',
            OrderStatus::InTransit => 'In transit',
            OrderStatus::OutForDelivery => 'Out for delivery',
            OrderStatus::Delivered => 'Delivered',
            OrderStatus::Cancelled => 'Cancelled',
            OrderStatus::Rejected => 'Rejected',
            OrderStatus::DeliveryFailed => 'Delivery failed',
            OrderStatus::ReturnRequested => 'Return requested',
            OrderStatus::Returned => 'Returned',
        };
    }

    /** @return array{canCancel: bool, canModify: bool, canReview: bool, modifiableFields: list<string>} */
    public function actions(OrderStatus $status): array
    {
        return [
            // The corresponding mutation features are not implemented yet. These
            // must become true only when their authoritative services are present.
            'canCancel' => false,
            'canModify' => false,
            'canReview' => $status === OrderStatus::Delivered,
            'modifiableFields' => [],
        ];
    }

    /** @return list<array{value: ?string, label: string}> */
    public function tabs(): array
    {
        return [
            ['value' => null, 'label' => 'All'],
            ...array_map(fn (CustomerOrderGroup $group) => [
                'value' => $group->value,
                'label' => $this->groupLabel($group),
            ], CustomerOrderGroup::cases()),
        ];
    }
}
