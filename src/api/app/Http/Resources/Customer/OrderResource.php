<?php

namespace App\Http\Resources\Customer;

use App\Services\Customer\CustomerOrderStatusMapper;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class OrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $statuses = app(CustomerOrderStatusMapper::class);
        $group = $statuses->groupFor($this->status);

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'checkoutBatchId' => $this->checkout_batch_id,
            'placedAt' => $this->placed_at->toISOString(),
            'latestTrackingAt' => $this->latest_tracking_at === null
                ? $this->placed_at->toISOString()
                : Carbon::parse($this->latest_tracking_at)->toISOString(),
            'status' => $this->status->value,
            'statusLabel' => $statuses->statusLabel($this->status),
            'group' => $group->value,
            'groupLabel' => $statuses->groupLabel($group),
            'shop' => [
                'id' => $this->shop->id,
                'slug' => $this->shop->slug,
                'name' => $this->shop->name,
                'logoUrl' => MediaUrl::from('public', $this->shop->logo_path),
            ],
            'items' => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'productId' => $item->product_id,
                'variantId' => $item->product_variant_id,
                'productName' => $item->product_name,
                'variantName' => $item->variant_name,
                'sku' => $item->sku,
                'selectedOptions' => $item->selected_options ?? [],
                'unitPrice' => $item->unit_price,
                'quantity' => $item->quantity,
                'lineSubtotal' => $item->line_subtotal,
                'currency' => $item->currency,
            ])->values(),
            'deliveryAddress' => [
                'recipientName' => $this->address->recipient_name,
                'contactNumber' => $this->address->contact_number,
                'addressLine1' => $this->address->address_line_1,
                'addressLine2' => $this->address->address_line_2,
                'barangay' => $this->address->barangay,
                'cityMunicipality' => $this->address->city_municipality,
                'province' => $this->address->province,
                'region' => $this->address->region,
                'postalCode' => $this->address->postal_code,
                'country' => $this->address->country,
            ],
            'payment' => [
                'method' => $this->payment_method->value,
                'status' => $this->payment_status->value,
            ],
            'vouchers' => $this->vouchers->map(fn ($voucher) => [
                'id' => $voucher->voucher_id,
                'code' => $voucher->code,
                'issuerType' => $voucher->issuer_type->value,
                'benefitType' => $voucher->benefit_type->value,
                'discountAmount' => $voucher->discount_amount,
                'currency' => $voucher->currency,
                'termsSummary' => $voucher->terms_summary,
            ])->values(),
            'totals' => [
                'merchandiseSubtotal' => $this->merchandise_subtotal,
                'shippingFee' => $this->shipping_fee,
                'discount' => $this->discount_total,
                'shippingDiscount' => $this->shipping_discount_total,
                'payable' => $this->payable_total,
                'currency' => $this->currency,
            ],
            'timeline' => OrderTrackingResource::collection($this->statusEvents),
            'timelineCount' => $this->status_events_count,
            'timelineHasMore' => $this->status_events_count > $this->statusEvents->count(),
            'trackingUrl' => '/api/v1/customer/orders/'.$this->id.'/tracking',
            'map' => [
                'available' => false,
                'state' => 'unavailable',
                'message' => 'Location is not available yet',
                'currentPosition' => null,
                'route' => null,
                'capturedAt' => null,
            ],
            'actions' => $statuses->actions($this->status),
        ];
    }
}
