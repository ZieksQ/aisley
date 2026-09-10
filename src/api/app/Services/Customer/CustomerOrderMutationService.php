<?php

namespace App\Services\Customer;

use App\Enums\AddressType;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Events\CustomerOrderStatusChanged;
use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\CustomerOrderCancellation;
use App\Models\CustomerOrderModification;
use App\Models\Order;
use App\Models\OrderStatusEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CustomerOrderMutationService
{
    public function __construct(
        private readonly CustomerOrderInventory $inventory,
        private readonly OrderTrackingService $orders,
    ) {}

    public function cancel(User $customer, string $orderId, string $idempotencyKey, ?string $reason): Order
    {
        $requestHash = $this->hash([
            'action' => 'cancel',
            'reason' => $reason === null ? null : trim($reason),
        ]);

        $resultId = DB::transaction(function () use ($customer, $orderId, $idempotencyKey, $requestHash, $reason): string {
            $previous = CustomerOrderCancellation::query()
                ->where('customer_id', $customer->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertIdempotent($previous->order_id, $orderId, $previous->request_hash, $requestHash);

                return $previous->order_id;
            }

            $order = $this->ownedOrder($customer, $orderId);

            // A concurrent request using the same key may have committed while this
            // request waited for the Order row lock. Re-check the idempotency record.
            $previous = CustomerOrderCancellation::query()
                ->where('customer_id', $customer->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertIdempotent($previous->order_id, $orderId, $previous->request_hash, $requestHash);

                return $previous->order_id;
            }

            $this->assertEligible($order, 'ORDER_NOT_CANCELLABLE', 'This Order is no longer available for cancellation.');
            [$requirements, $skus, $balances] = $this->inventory->lockReservation($order);

            $event = $this->transition($order, OrderStatus::Cancelled, 'customer_order_cancellation');
            $this->inventory->release(
                $order,
                $customer,
                $requirements,
                $skus,
                $balances,
                'Released after Customer cancelled the Order.',
            );

            CustomerOrderCancellation::create([
                'order_id' => $order->id,
                'customer_id' => $customer->id,
                'status_event_id' => $event->id,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'reason' => $reason === null ? null : trim($reason),
            ]);

            return $order->id;
        }, 3);

        return $this->orders->order($customer, $resultId);
    }

    public function modifyAddress(
        User $customer,
        string $orderId,
        string $addressId,
        string $idempotencyKey,
        ?int $expectedRevision,
    ): Order {
        $requestHash = $this->hash([
            'action' => 'delivery_address',
            'address_id' => strtolower($addressId),
            'expected_revision' => $expectedRevision,
        ]);

        $resultId = DB::transaction(function () use (
            $customer,
            $orderId,
            $addressId,
            $idempotencyKey,
            $requestHash,
            $expectedRevision,
        ): string {
            $previous = CustomerOrderModification::query()
                ->where('customer_id', $customer->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertIdempotent($previous->order_id, $orderId, $previous->request_hash, $requestHash);

                return $previous->order_id;
            }

            $order = $this->ownedOrder($customer, $orderId);
            $previous = CustomerOrderModification::query()
                ->where('customer_id', $customer->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertIdempotent($previous->order_id, $orderId, $previous->request_hash, $requestHash);

                return $previous->order_id;
            }

            $this->assertEligible($order, 'ORDER_NOT_MODIFIABLE', 'This Order is no longer available for modification.');
            $currentAddress = $order->addressVersions()
                ->orderByDesc('version')
                ->lockForUpdate()
                ->first();
            if ($currentAddress === null) {
                throw CheckoutException::conflict(
                    'ORDER_ADDRESS_UNAVAILABLE',
                    'This Order does not have a delivery address snapshot.',
                );
            }
            if ($expectedRevision !== null && $expectedRevision !== $currentAddress->version) {
                throw CheckoutException::conflict(
                    'ORDER_REVISION_STALE',
                    'This Order changed before your address update was submitted. Refresh and try again.',
                    'expected_revision',
                );
            }

            $address = Address::query()
                ->where('user_id', $customer->id)
                ->whereKey($addressId)
                ->lockForUpdate()
                ->first();
            if ($address === null) {
                throw CheckoutException::invalid('ADDRESS_NOT_FOUND', 'Select an address from your Address Book.', 'address_id');
            }
            if ($address->type === AddressType::Billing) {
                throw CheckoutException::invalid('ADDRESS_NOT_SHIPPING', 'The selected address is not available for shipping.', 'address_id');
            }
            $this->assertCompleteAddress($address);

            if ($currentAddress->source_address_id === $address->id) {
                throw CheckoutException::conflict('ADDRESS_UNCHANGED', 'Select a different delivery address.', 'address_id');
            }

            $newAddress = $order->addressVersions()->create([
                'version' => $currentAddress->version + 1,
                'source_address_id' => $address->id,
                'recipient_name' => $address->recipient_name,
                'contact_number' => $address->contact_number,
                'address_line_1' => $address->address_line_1,
                'address_line_2' => $address->address_line_2,
                'barangay' => $address->barangay,
                'city_municipality' => $address->city_municipality,
                'province' => $address->province,
                'region' => $address->region,
                'postal_code' => $address->postal_code,
                'country' => $address->country,
                'latitude' => $address->latitude,
                'longitude' => $address->longitude,
            ]);
            $event = $order->statusEvents()->create([
                'from_status' => OrderStatus::Placed,
                'to_status' => OrderStatus::Placed,
                'source' => 'customer_order_modification',
                'public_metadata' => [
                    'label' => 'Delivery address updated',
                    'event_type' => 'customer_order_modified',
                ],
                'occurred_at' => now(),
            ]);
            DB::afterCommit(fn () => event(new CustomerOrderStatusChanged($event->id)));

            CustomerOrderModification::create([
                'order_id' => $order->id,
                'customer_id' => $customer->id,
                'status_event_id' => $event->id,
                'previous_address_id' => $currentAddress->id,
                'new_address_id' => $newAddress->id,
                'change_type' => 'delivery_address',
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'expected_revision' => $expectedRevision,
            ]);

            return $order->id;
        }, 3);

        return $this->orders->order($customer, $resultId);
    }

    private function ownedOrder(User $customer, string $orderId): Order
    {
        return Order::query()
            ->where('customer_id', $customer->id)
            ->whereKey($orderId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function assertEligible(Order $order, string $code, string $message): void
    {
        if (
            $order->status !== OrderStatus::Placed
            || $order->payment_method !== PaymentMethod::CashOnDelivery
            || $order->payment_status !== PaymentStatus::Pending
            || ! $order->items()->exists()
            || ! $order->addressVersions()->exists()
            || $order->pickupRequestOrder()->exists()
            || $order->waybill()->exists()
            || $order->firstMileTask()->exists()
        ) {
            throw CheckoutException::conflict($code, $message);
        }
    }

    private function transition(Order $order, OrderStatus $to, string $source): OrderStatusEvent
    {
        $from = $order->status;
        if ($from !== OrderStatus::Placed) {
            throw CheckoutException::conflict('ORDER_TRANSITION_CONFLICT', 'This Order is no longer available for that action.');
        }

        $order->update(['status' => $to]);
        $event = $order->statusEvents()->create([
            'from_status' => $from,
            'to_status' => $to,
            'source' => $source,
            'occurred_at' => now(),
        ]);
        DB::afterCommit(fn () => event(new CustomerOrderStatusChanged($event->id)));

        return $event;
    }

    private function assertIdempotent(
        string $previousOrderId,
        string $requestedOrderId,
        string $previousHash,
        string $requestHash,
    ): void {
        if ($previousOrderId !== $requestedOrderId || ! hash_equals($previousHash, $requestHash)) {
            throw CheckoutException::conflict(
                'IDEMPOTENCY_KEY_REUSED',
                'This Idempotency-Key was already used for different Order details.',
                'idempotency_key',
            );
        }
    }

    private function assertCompleteAddress(Address $address): void
    {
        foreach (['recipient_name', 'contact_number', 'address_line_1', 'barangay', 'city_municipality', 'province', 'region', 'postal_code', 'country'] as $field) {
            if (trim((string) $address->{$field}) === '') {
                throw CheckoutException::invalid('ADDRESS_INCOMPLETE', 'The selected address is incomplete.', 'address_id');
            }
        }
    }

    /** @param array<string, mixed> $value */
    private function hash(array $value): string
    {
        return hash('sha256', json_encode($value, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
    }
}
