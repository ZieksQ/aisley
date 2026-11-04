<?php

namespace App\Services\Customer;

use App\Enums\AddressType;
use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\Order;
use App\Models\OrderAddress;
use App\Models\OrderModificationQuote;
use App\Models\OrderPricingSnapshot;
use App\Models\User;
use App\Services\Logistics\Sorting\SortingLocks;
use App\Support\AddressCoordinates;
use Illuminate\Support\Facades\DB;

class OrderAddressChange
{
    private const ADDRESS_FIELDS = [
        'recipient_name', 'contact_number', 'address_line_1', 'address_line_2', 'barangay',
        'city_municipality', 'province', 'region', 'postal_code', 'country', 'latitude', 'longitude',
    ];

    public function __construct(
        private readonly OrderAddressPricing $pricing,
        private readonly CheckoutAddressFingerprint $addresses,
        private readonly CustomerOrderMutationGuard $guard,
    ) {}

    /** @return array<string, mixed> */
    public function quote(User $customer, string $orderId, string $addressId, int $revision): array
    {
        return DB::transaction(function () use ($customer, $orderId, $addressId, $revision): array {
            SortingLocks::network();
            $order = Order::where('customer_id', $customer->id)->whereKey($orderId)->lockForUpdate()->firstOrFail();
            $this->guard->assertEligible($order, 'ORDER_NOT_MODIFIABLE', 'This Order can no longer be changed.');
            $address = Address::where('user_id', $customer->id)->whereKey($addressId)->lockForUpdate()->first();
            $this->validateAddress($order, $address, $revision);
            $calculation = $this->pricing->calculate($order, $address);
            $pricing = $calculation['snapshot'];
            $quote = OrderModificationQuote::create([
                'customer_id' => $customer->id, 'order_id' => $order->id, 'address_id' => $address->id,
                'expected_revision' => $revision, 'state_hash' => $this->fingerprint($order, $address, $pricing, $calculation['state']),
                'expires_at' => now()->addMinutes(10),
            ]);

            return [
                'quoteId' => $quote->id, 'expiresAt' => $quote->expires_at->toISOString(),
                'expectedRevision' => $revision,
                'address' => $address,
                'shippingProvider' => ['id' => $order->selected_logistics_organization_id, 'businessName' => $order->selectedLogisticsOrganization->business_name],
                'previous' => $this->totals($order),
                'proposed' => [
                    'shippingFee' => $this->pricing->money($pricing->quoted_shipping_fee_cents),
                    'shippingDiscount' => $this->pricing->money($this->shippingSaving($pricing)),
                    'payable' => $this->pricing->money($pricing->cod_total_cents), 'currency' => $order->currency,
                ],
            ];
        }, 3);
    }

    /** Called only while the mutation transaction holds the routing, Order and address locks. */
    public function apply(User $customer, Order $order, Address $address, string $quoteId, ?int $revision): OrderAddress
    {
        $quote = OrderModificationQuote::where('customer_id', $customer->id)->where('order_id', $order->id)
            ->whereKey($quoteId)->lockForUpdate()->first();
        if ($quote === null || $quote->address_id !== $address->id || $quote->expected_revision !== $revision) {
            throw CheckoutException::conflict('MODIFICATION_QUOTE_STALE', 'Review this address change again before confirming.', 'quote_id');
        }
        if ($quote->expires_at->lte(now())) {
            throw CheckoutException::conflict('MODIFICATION_QUOTE_EXPIRED', 'This delivery quote expired. Review the updated delivery total.', 'quote_id');
        }
        $this->validateAddress($order, $address, $revision);
        $calculation = $this->pricing->calculate($order, $address);
        $pricing = $calculation['snapshot'];
        if (! hash_equals($quote->state_hash, $this->fingerprint($order, $address, $pricing, $calculation['state']))) {
            throw CheckoutException::conflict('MODIFICATION_QUOTE_STALE', 'The address or delivery terms changed. Review a fresh quote before confirming.', 'quote_id');
        }
        $next = $order->addressVersions()->create([
            ...$address->only(self::ADDRESS_FIELDS), 'source_address_id' => $address->id, 'version' => $revision + 1,
        ]);
        $pricing->snapshotted_at = now();
        $pricing->save();
        $order->update([
            'shipping_fee' => $this->pricing->money($pricing->quoted_shipping_fee_cents),
            'shipping_discount_total' => $this->pricing->money($this->shippingSaving($pricing)),
            'payable_total' => $this->pricing->money($pricing->cod_total_cents),
        ]);

        return $next;
    }

    private function validateAddress(Order $order, ?Address $address, ?int $revision): void
    {
        if ($revision !== $order->address->version) {
            throw CheckoutException::conflict('ORDER_REVISION_STALE', 'This Order changed. Refresh it before changing the address.', 'expected_revision');
        }
        if ($address === null) {
            throw CheckoutException::invalid('ADDRESS_NOT_FOUND', 'Select one of your saved shipping addresses.', 'address_id');
        }
        if ($address->type === AddressType::Billing) {
            throw CheckoutException::invalid('ADDRESS_NOT_SHIPPING', 'Select a shipping address.', 'address_id');
        }
        foreach (array_diff(self::ADDRESS_FIELDS, ['address_line_2', 'latitude', 'longitude']) as $field) {
            if (trim((string) $address->{$field}) === '') {
                throw CheckoutException::invalid('ADDRESS_INCOMPLETE', 'The selected address is incomplete.', 'address_id');
            }
        }
        if (! AddressCoordinates::valid($address->latitude, $address->longitude)) {
            throw CheckoutException::invalid('ADDRESS_PIN_REQUIRED', 'Pin this address in your Address Book before changing the delivery address.', 'address_id');
        }
        $same = collect(self::ADDRESS_FIELDS)->every(fn ($field) => trim((string) $address->{$field}) === trim((string) $order->address->{$field}));
        if ($same) {
            throw CheckoutException::conflict('ADDRESS_UNCHANGED', 'Select a different saved delivery address.', 'address_id');
        }
    }

    private function fingerprint(Order $order, Address $address, OrderPricingSnapshot $pricing, array $state): string
    {
        $proposed = $pricing->attributesToArray();
        unset($proposed['shipping_route_snapshot']['calculated_at']);

        $payload = [
            'address' => $this->addresses->state($address),
            'current_address' => $order->address->getAttributes(),
            'current_pricing' => $order->pricingSnapshot->getAttributes(),
            'order' => $order->getAttributes(),
            'pricing' => $proposed, 'shipping_state' => $state,
        ];

        return hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR));
    }

    private function shippingSaving(OrderPricingSnapshot $pricing): int
    {
        return collect($pricing->voucher_funding)->where('benefit', 'shipping')->sum('amount_cents');
    }

    private function totals(Order $order): array
    {
        return ['shippingFee' => $order->shipping_fee, 'shippingDiscount' => $order->shipping_discount_total,
            'payable' => $order->payable_total, 'currency' => $order->currency];
    }
}
