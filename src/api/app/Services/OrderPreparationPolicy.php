<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Order;
use Illuminate\Support\Str;

class OrderPreparationPolicy
{
    public function projection(Order $order): array
    {
        $accepted = $order->sellerAcceptanceEvent?->occurred_at;
        $extension = $order->preparationExtension;
        $deadline = $extension?->deadline_at ?? $accepted?->copy()->addHours(72);
        $active = $order->status === OrderStatus::SellerProcessing;
        $overdue = $active && $accepted !== null && $deadline !== null && now()->greaterThanOrEqualTo($deadline);

        return [
            'acceptedAt' => $accepted?->toISOString(),
            'initialDeadlineAt' => $accepted?->copy()->addHours(72)->toISOString(),
            'deadlineAt' => $deadline?->toISOString(),
            'extendedAt' => $extension?->approved_at->toISOString(),
            'extensionUsed' => $extension !== null,
            'overdue' => $overdue,
            'active' => $active && $accepted !== null,
            'serverTime' => now()->toISOString(),
        ];
    }

    public function canCancelOverdue(Order $order): bool
    {
        return $order->status === OrderStatus::SellerProcessing
            && $this->projection($order)['overdue']
            && $order->payment_method === PaymentMethod::CashOnDelivery
            && $order->payment_status === PaymentStatus::Pending
            && $this->exists($order, 'items')
            && $this->exists($order, 'addressVersions')
            && ! $this->exists($order, 'pickupRequestOrder')
            && ! $this->exists($order, 'waybill')
            && ! $this->exists($order, 'parcel')
            && ! $this->exists($order, 'firstMileTask');
    }

    public function canExtend(Order $order): bool
    {
        return $this->canCancelOverdue($order) && $order->preparationExtension === null;
    }

    private function exists(Order $order, string $relation): bool
    {
        $attribute = Str::snake($relation).'_exists';

        return array_key_exists($attribute, $order->getAttributes())
            ? (bool) $order->getAttribute($attribute)
            : $order->{$relation}()->exists();
    }
}
