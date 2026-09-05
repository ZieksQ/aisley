<?php

namespace App\Http\Resources\Courier;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'email' => $this->email, 'role' => $this->role->value, 'status' => $this->status->value, 'profile' => $this->whenLoaded('courierProfile', fn () => ['first_name' => $this->courierProfile?->first_name, 'last_name' => $this->courierProfile?->last_name, 'age' => $this->courierProfile?->age]), 'logistics' => $this->whenLoaded('courierLogisticsAffiliation', fn () => ['status' => $this->courierLogisticsAffiliation?->status?->value, 'organization' => $this->courierLogisticsAffiliation?->organization?->business_name, 'hub' => $this->courierLogisticsAffiliation?->hub?->name])];
    }
}
