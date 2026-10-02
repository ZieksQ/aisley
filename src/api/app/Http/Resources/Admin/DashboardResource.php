<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DashboardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'registrations' => $this->resource['registrations'],
            'support_tickets' => $this->resource['support_tickets'],
            'seller_compliance' => $this->resource['seller_compliance'],
            'generated_at' => $this->resource['generated_at'],
        ];
    }
}
