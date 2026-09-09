<?php

namespace App\Http\Resources\Seller;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerOrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'placed_at' => $this->placed_at->toIso8601String(),
            'latest_activity_at' => $this->latest_activity_at === null ? $this->placed_at->toIso8601String() : $this->latest_activity_at,
            'status' => $this->status->value,
            'payment' => [
                'method' => $this->payment_method->value,
                'status' => $this->payment_status->value,
            ],
            'items' => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'variant_id' => $item->product_variant_id,
                'product_name' => $item->product_name,
                'variant_name' => $item->variant_name,
                'sku' => $item->sku,
                'selected_options' => $item->selected_options ?? [],
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
                'line_subtotal' => $item->line_subtotal,
                'currency' => $item->currency,
            ])->values(),
            'delivery_address' => $this->address === null ? null : [
                'recipient_name' => $this->address->recipient_name,
                'contact_number' => $this->address->contact_number,
                'address_line_1' => $this->address->address_line_1,
                'address_line_2' => $this->address->address_line_2,
                'barangay' => $this->address->barangay,
                'city_municipality' => $this->address->city_municipality,
                'province' => $this->address->province,
                'region' => $this->address->region,
                'postal_code' => $this->address->postal_code,
                'country' => $this->address->country,
            ],
            'totals' => [
                'merchandise_subtotal' => $this->merchandise_subtotal,
                'shipping_fee' => $this->shipping_fee,
                'discount' => $this->discount_total,
                'shipping_discount' => $this->shipping_discount_total,
                'payable' => $this->payable_total,
                'currency' => $this->currency,
            ],
            'status_history' => $this->statusEvents->map(fn ($event) => [
                'id' => $event->id,
                'from_status' => $event->from_status?->value,
                'to_status' => $event->to_status->value,
                'occurred_at' => $event->occurred_at->toIso8601String(),
            ])->values(),
            'capabilities' => [
                'can_approve' => (bool) $this->seller_can_approve,
                'can_reject' => (bool) $this->seller_can_reject,
                'can_prepare' => (bool) $this->seller_can_prepare,
                'can_view_waybill' => (bool) $this->seller_can_view_waybill,
            ],
            'pickup' => $this->pickupRequestOrder?->sellerPickupRequest === null ? null : [
                'request_id' => $this->pickupRequestOrder->sellerPickupRequest->id,
                'status' => $this->pickupRequestOrder->sellerPickupRequest->status,
                'pickup_date' => $this->pickupRequestOrder->sellerPickupRequest->pickup_date?->toDateString(),
                'logistics_organization_id' => $this->pickupRequestOrder->sellerPickupRequest->logistics_organization_id,
                'schedule' => $this->firstMileTask?->schedule === null ? null : [
                    'id' => $this->firstMileTask->schedule->id,
                    'reference' => $this->firstMileTask->schedule->reference,
                    'status' => $this->firstMileTask->schedule->status->value,
                    'starts_at' => $this->firstMileTask->schedule->starts_at->toIso8601String(),
                    'ends_at' => $this->firstMileTask->schedule->ends_at->toIso8601String(),
                    'timezone' => 'Asia/Manila',
                ],
            ],
            'waybill' => $this->waybill === null ? null : [
                'id' => $this->waybill->id,
                'reference' => $this->waybill->reference,
                'created_at' => $this->waybill->created_at->toISOString(),
                'pdf_url' => "/api/v1/seller/orders/{$this->id}/waybill",
            ],
            'notification' => $this->seller_notification_id === null ? null : [
                'id' => $this->seller_notification_id,
                'read_at' => $this->seller_notification_read_at?->toIso8601String(),
            ],
        ];
    }
}
