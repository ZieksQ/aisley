<?php

namespace App\Http\Resources\Logistics;

use App\Models\CourierProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierAssignmentVehicleResource extends JsonResource
{
    public static function forProfile(?CourierProfile $profile): ?self
    {
        $vehicles = $profile?->vehicles;

        return $vehicles?->count() === 1 ? new self($vehicles->sole()) : null;
    }

    public function toArray(Request $request): array
    {
        return [
            'vehicle_type' => $this->type->value,
            'plate_number' => $this->plate_number,
        ];
    }
}
