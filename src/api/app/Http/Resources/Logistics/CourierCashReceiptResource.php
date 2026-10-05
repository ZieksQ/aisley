<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierCashReceiptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'courier_id' => $this->courier_id, 'courier_name' => $this->courier_name,
            'currency' => $this->currency, 'total_cents' => $this->total_cents,
            'received_by' => $this->received_by, 'received_at' => $this->received_at->toISOString(),
            'simulation_credit' => $this->credit?->credited_at !== null ? 'credited' : 'pending',
            'orders' => $this->items->map(fn ($item) => ['reference' => $item->obligation->order_reference, 'amount_cents' => $item->amount_cents])];
    }
}
