<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CheckoutBatchResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'currency' => $this->currency,
            'placedAt' => $this->placed_at->toISOString(),
            'orders' => $this->orders->map(fn ($order) => [
                'id' => $order->id,
                'reference' => $order->reference,
                'status' => $order->status->value,
                'paymentMethod' => $order->payment_method->value,
                'paymentStatus' => $order->payment_status->value,
                'shop' => ['id' => $order->shop->id, 'name' => $order->shop->name],
                'items' => $order->items->map(fn ($item) => [
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
                'address' => [
                    'recipientName' => $order->address->recipient_name,
                    'contactNumber' => $order->address->contact_number,
                    'addressLine1' => $order->address->address_line_1,
                    'addressLine2' => $order->address->address_line_2,
                    'barangay' => $order->address->barangay,
                    'cityMunicipality' => $order->address->city_municipality,
                    'province' => $order->address->province,
                    'region' => $order->address->region,
                    'postalCode' => $order->address->postal_code,
                    'country' => $order->address->country,
                    'latitude' => $order->address->latitude,
                    'longitude' => $order->address->longitude,
                ],
                'vouchers' => $order->vouchers->map(fn ($voucher) => [
                    'id' => $voucher->voucher_id,
                    'code' => $voucher->code,
                    'issuerType' => $voucher->issuer_type->value,
                    'benefitType' => $voucher->benefit_type->value,
                    'qualifyingBasis' => $voucher->qualifying_basis,
                    'discountAmount' => $voucher->discount_amount,
                    'termsSummary' => $voucher->terms_summary,
                ])->values(),
                'totals' => [
                    'merchandiseSubtotal' => $order->merchandise_subtotal,
                    'shippingFee' => $order->shipping_fee,
                    'discount' => $order->discount_total,
                    'shippingDiscount' => $order->shipping_discount_total,
                    'payable' => $order->payable_total,
                    'currency' => $order->currency,
                ],
                'detailUrl' => '/orders/'.$order->id,
            ])->values(),
        ];
    }

    public function withResponse(Request $request, JsonResponse $response): void
    {
        $response->headers->set('Cache-Control', 'no-store, private');
    }
}
