<?php

namespace App\Http\Resources\Finance;

use App\Services\Finance\Automation\RemittanceService;
use Illuminate\Http\Resources\Json\JsonResource;

class CodInvoiceResource extends JsonResource
{
    public function toArray($request): array
    {
        $cleared = app(RemittanceService::class)->allocated($this->order_id, ['cleared']);

        return ['id' => $this->id, 'reference' => $this->reference, 'order_id' => $this->order_id, 'order_reference' => $this->order_reference,
            'logistics_organization_id' => $this->logistics_organization_id, 'collector_name' => $this->collector_name,
            'currency' => $this->currency, 'total_cents' => $this->total_cents, 'remaining_cents' => max(0, $this->total_cents - $cleared),
            'status' => $this->status->value, 'overdue' => $this->paid_at === null && $this->due_at->isPast(),
            'delivered_at' => $this->delivered_at->toISOString(), 'due_at' => $this->due_at->toISOString(),
            'seller_eligible_at' => $this->seller_eligible_at->toISOString(), 'logistics_eligible_at' => $this->logistics_eligible_at->toISOString(),
            'paid_at' => $this->paid_at?->toISOString(), 'review_reason' => $this->review_reason];
    }
}
