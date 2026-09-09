<?php

namespace App\Services\Waybills;

use App\Models\Address;
use App\Models\Order;
use App\Models\SellerPickupRequest;
use App\Models\Waybill;
use Illuminate\Support\Str;

class CreateWaybill
{
    public function handle(Order $order, SellerPickupRequest $pickup, Address $sellerAddress): Waybill
    {
        $order->loadMissing(['items', 'address', 'shop', 'shop.seller.sellerProfile']);
        $pickup->loadMissing(['organization', 'hub.address']);
        $reference = $this->uniqueReference();
        $qrPayload = 'AISLEY:WB:1:'.$reference;
        $snapshot = [
            'schema_version' => 1,
            'created_at' => now()->toISOString(),
            'waybill_reference' => $reference,
            'order_reference' => $order->reference,
            'shop' => ['name' => $order->shop->name, 'contact_number' => $order->shop->contact_number],
            'pickup' => $this->address($sellerAddress, $order->shop->name, $order->shop->contact_number),
            'recipient' => $this->address($order->address, $order->address->recipient_name, $order->address->contact_number),
            'logistics' => ['business_name' => $pickup->organization->business_name, 'hub_name' => $pickup->hub->name, 'hub_area' => $this->area($pickup->hub->address)],
            'payment' => ['method' => $order->payment_method->value, 'cod' => true, 'collectible_amount' => (string) $order->payable_total, 'currency' => $order->currency],
            'item_quantity' => $order->items->sum('quantity'),
            'qr_payload' => $qrPayload,
        ];
        $checksum = hash('sha256', json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $waybill = Waybill::create([
            'order_id' => $order->id, 'seller_pickup_request_id' => $pickup->id, 'shop_id' => $pickup->shop_id,
            'logistics_organization_id' => $pickup->logistics_organization_id, 'logistics_hub_id' => $pickup->logistics_hub_id,
            'reference' => $reference, 'qr_token_hash' => $this->hashQr($qrPayload), 'content_checksum' => $checksum,
        ]);
        $waybill->snapshot()->create(['payload' => $snapshot]);

        return $waybill->load('snapshot');
    }

    public function hashQr(string $payload): string
    {
        return hash_hmac('sha256', $payload, (string) config('app.key'));
    }

    private function uniqueReference(): string
    {
        do {
            $reference = 'AWB-'.strtoupper(Str::random(16));
        } while (Waybill::query()->where('reference', $reference)->exists());

        return $reference;
    }

    private function address($address, string $name, ?string $phone): array
    {
        return ['name' => $name, 'contact_number' => $phone, 'address_line_1' => $address->address_line_1, 'address_line_2' => $address->address_line_2, ...$this->area($address), 'barangay' => $address->barangay, 'postal_code' => $address->postal_code, 'latitude' => $address->latitude, 'longitude' => $address->longitude];
    }

    private function area($address): array
    {
        return ['city_municipality' => $address->city_municipality, 'province' => $address->province, 'region' => $address->region, 'country' => $address->country];
    }
}
