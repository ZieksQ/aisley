<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierCashObligationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'order_reference' => $this->order_reference,
            'courier_id' => $this->courier_id, 'courier_name' => $this->courier_name,
            'currency' => $this->currency, 'amount_cents' => $this->amount_cents,
            'delivered_at' => $this->delivered_at?->toISOString()];
    }
}
