<?php

namespace App\Http\Resources\Admin;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FinanceHoldResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $order = $this->order;
        $snapshot = $order?->pricingSnapshot;
        $destination = $snapshot?->destination_snapshot ?? [];
        $routeStatus = $snapshot?->shipping_route_status;

        return [
            'id' => $this->id,
            'reason_code' => $this->reason_code,
            'reason_label' => self::reasonLabel($this->reason_code),
            'notes' => $this->notes,
            'placed_at' => $this->placed_at,
            'released_at' => $this->released_at,
            'is_open' => $this->released_at === null,
            'order' => $order === null ? null : [
                'id' => $order->id,
                'reference' => $order->reference,
                'status' => self::enumValue($order->status),
                'currency' => $order->currency,
                'shop_name' => $order->shop?->name,
                'selected_logistics_organization' => $order->selectedLogisticsOrganization === null ? null : [
                    'id' => $order->selectedLogisticsOrganization->id,
                    'business_name' => $order->selectedLogisticsOrganization->business_name,
                ],
            ],
            'pricing' => $snapshot === null ? null : [
                'pricing_model' => self::enumValue($snapshot->shipping_pricing_model),
                'route_status' => self::enumValue($routeStatus),
                'logistics_pool_cents' => $snapshot->logistics_pool_cents,
                'quoted_shipping_fee_cents' => $snapshot->quoted_shipping_fee_cents,
                'base_fee_cents' => $snapshot->base_fee_cents,
                'additional_weight_fee_cents' => $snapshot->additional_weight_fee_cents,
                'destination_surcharge_cents' => $snapshot->destination_surcharge_cents,
                'billable_weight_grams' => $snapshot->billable_weight_grams,
                'destination' => [
                    'region' => $destination['region'] ?? null,
                    'province' => $destination['province'] ?? null,
                    'city_municipality' => $destination['city_municipality'] ?? null,
                ],
            ],
            'reconciliation' => $this->whenLoaded('routeReconciliation', fn () => $this->routeReconciliation === null ? null : [
                'id' => $this->routeReconciliation->id,
                'shipping_pool_cents' => $this->routeReconciliation->shipping_pool_cents,
                'platform_subsidy_cents' => $this->routeReconciliation->platform_subsidy_cents,
                'total_allocation_cents' => $this->routeReconciliation->total_allocation_cents,
                'allocations' => $this->routeReconciliation->allocations,
                'notes' => $this->routeReconciliation->notes,
                'reconciled_at' => $this->routeReconciliation->reconciled_at,
            ]),
        ];
    }

    private static function enumValue(mixed $value): mixed
    {
        return $value instanceof BackedEnum ? $value->value : $value;
    }

    private static function reasonLabel(string $reason): string
    {
        return match ($reason) {
            'UNPLANNED_ROUTE_RECONCILIATION_REQUIRED' => 'Unplanned route',
            'LOGISTICS_QUOTED_CHARGES_MISSING' => 'Quoted carrier charges missing',
            'LOGISTICS_EVIDENCE_MISSING' => 'Carrier evidence missing',
            'LINEHAUL_EVIDENCE_MISSING' => 'Linehaul evidence missing',
            default => 'Finance hold',
        };
    }
}
