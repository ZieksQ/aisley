<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LogisticsUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'email' => $this->email, 'role' => $this->role->value, 'status' => $this->status->value,
            'profile' => $this->whenLoaded('logisticsProfile', fn () => ['first_name' => $this->logisticsProfile?->first_name, 'last_name' => $this->logisticsProfile?->last_name, 'middle_name' => $this->logisticsProfile?->middle_name, 'contact_number' => $this->logisticsProfile?->contact_number, 'sex' => $this->logisticsProfile?->sex?->value, 'birth_date' => $this->logisticsProfile?->birth_date?->toDateString(), 'age' => $this->logisticsProfile?->age]),
            'organization' => $this->whenLoaded('logisticsOrganization', fn () => $this->logisticsOrganization ? ['id' => $this->logisticsOrganization->id, 'business_name' => $this->logisticsOrganization->business_name, 'hub' => $this->logisticsOrganization->hub ? ['id' => $this->logisticsOrganization->hub->id, 'name' => $this->logisticsOrganization->hub->name] : null] : null),
        ];
    }
}
