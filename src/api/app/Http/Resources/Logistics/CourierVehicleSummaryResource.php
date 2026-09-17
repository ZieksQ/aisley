<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierVehicleSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $profile = $this->courierProfile;
        $courier = $profile?->user;

        return [
            'courier' => [
                'id' => (string) $courier->id,
                'name' => trim(implode(' ', array_filter([$profile->first_name, $profile->middle_name, $profile->last_name]))) ?: $courier->email,
                'email' => $courier->email,
            ],
            'vehicle' => [
                'id' => (string) $this->id,
                'vehicle_type' => $this->type?->value,
                'plate_number' => $this->plate_number,
                'make' => $this->make,
                'model' => $this->model,
                'revision' => (int) $this->revision,
                'official_receipt_uploaded' => $this->official_receipt_document_id !== null,
                'certificate_of_registration_uploaded' => $this->certificate_of_registration_document_id !== null,
            ],
        ];
    }
}
