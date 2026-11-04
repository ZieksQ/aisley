<?php

namespace App\Services\Customer;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Exceptions\Customer\CheckoutException;
use App\Models\Order;

class CustomerOrderMutationGuard
{
    public function assertEligible(Order $order, string $code, string $message): void
    {
        if (
            $order->status !== OrderStatus::Placed
            || $order->payment_method !== PaymentMethod::CashOnDelivery
            || $order->payment_status !== PaymentStatus::Pending
            || ! $order->items()->exists()
            || ! $order->addressVersions()->exists()
            || $order->pickupRequestOrder()->exists()
            || $order->waybill()->exists()
            || $order->parcel()->exists()
            || $order->firstMileTask()->exists()
        ) {
            throw CheckoutException::conflict($code, $message);
        }
    }
}
