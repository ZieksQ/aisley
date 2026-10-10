<?php

namespace App\Http\Resources\Customer;

use App\Services\Customer\CustomerOrderStatusMapper;
use App\Support\MediaUrl;
use App\Support\ProductImageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class OrderSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $statuses = app(CustomerOrderStatusMapper::class);
        $group = $statuses->groupFor($this->status);
        $preview = $this->items->first();

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'shop' => [
                'id' => $this->shop->id,
                'slug' => $this->shop->slug,
                'name' => $this->shop->name,
                'logoUrl' => MediaUrl::from('public', $this->shop->logo_path),
            ],
            'shippingProvider' => $this->selectedLogisticsOrganization === null ? null : [
                'id' => $this->selectedLogisticsOrganization->id,
                'businessName' => $this->selectedLogisticsOrganization->business_name,
            ],
            'itemPreview' => $preview === null ? null : [
                'productId' => $preview->product_id,
                'productName' => $preview->product_name,
                'variantName' => $preview->variant_name,
                'quantity' => $preview->quantity,
                'imageUrl' => ProductImageUrl::from($preview->product, $preview->variant),
            ],
            'lineCount' => $this->items->count(),
            'itemCount' => $this->items->sum('quantity'),
            'status' => $this->status->value,
            'statusLabel' => $statuses->statusLabel($this->status),
            'group' => $group->value,
            'groupLabel' => $statuses->groupLabel($group),
            'latestTrackingAt' => $this->latest_tracking_at === null
                ? $this->placed_at->toISOString()
                : Carbon::parse($this->latest_tracking_at)->toISOString(),
            'totals' => [
                'merchandiseSubtotal' => $this->merchandise_subtotal,
                'shippingFee' => $this->shipping_fee,
                'discount' => $this->discount_total,
                'shippingDiscount' => $this->shipping_discount_total,
                'payable' => $this->payable_total,
                'currency' => $this->currency,
            ],
            'actions' => $statuses->actions($this->status),
            'detailUrl' => '/orders/'.$this->id,
        ];
    }
}
