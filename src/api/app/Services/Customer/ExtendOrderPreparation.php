<?php

namespace App\Services\Customer;

use App\Exceptions\Customer\CheckoutException;
use App\Models\Order;
use App\Models\OrderPreparationExtension;
use App\Models\User;
use App\Services\OrderPreparationPolicy;
use Illuminate\Support\Facades\DB;

class ExtendOrderPreparation
{
    public function __construct(
        private readonly OrderPreparationPolicy $policy,
        private readonly OrderTrackingService $orders,
    ) {}

    public function handle(User $customer, string $orderId, string $key): Order
    {
        $hash = hash('sha256', 'preparation-extension:'.$orderId);
        DB::transaction(function () use ($customer, $orderId, $key, $hash): void {
            // Serialize keys across this Customer's Orders without blocking FK key-share locks.
            User::query()->whereKey($customer->id)->lock('for no key update')->firstOrFail();
            $order = Order::query()->where('customer_id', $customer->id)->whereKey($orderId)->lockForUpdate()->firstOrFail();
            $previous = OrderPreparationExtension::query()->where('customer_id', $customer->id)
                ->where('idempotency_key', $key)->first();
            if ($previous !== null) {
                if ($previous->order_id !== $orderId || ! hash_equals($previous->request_hash, $hash)) {
                    throw CheckoutException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another Order.');
                }

                return;
            }
            if (! $this->policy->canExtend($order)) {
                throw CheckoutException::conflict('ORDER_PREPARATION_NOT_EXTENDABLE', 'Preparation cannot be extended. Refresh the Order to see available actions.');
            }
            $approvedAt = now();
            $deadline = $approvedAt->copy()->addHours(72);
            $event = $order->statusEvents()->create([
                'from_status' => $order->status,
                'to_status' => $order->status,
                'source' => 'customer_preparation_extension',
                'public_metadata' => [
                    'label' => 'Buyer extended seller preparation by 3 days',
                    'event_type' => 'preparation_extended',
                ],
                'occurred_at' => $approvedAt,
            ]);
            OrderPreparationExtension::create([
                'order_id' => $order->id,
                'customer_id' => $customer->id,
                'status_event_id' => $event->id,
                'idempotency_key' => $key,
                'request_hash' => $hash,
                'approved_at' => $approvedAt,
                'deadline_at' => $deadline,
            ]);
        }, 3);

        return $this->orders->order($customer, $orderId);
    }
}
