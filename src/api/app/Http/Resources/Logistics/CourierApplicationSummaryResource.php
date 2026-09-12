<?php

namespace App\Http\Resources\Logistics;

use App\Enums\DocumentType;
use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierApplicationSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $courier = $this->courier;
        $profile = $courier?->courierProfile;
        $application = $courier?->registrationApplications
            ?->firstWhere('application_type', UserRole::Courier);
        $documents = $application?->documents ?? collect();
        $address = $courier?->addresses
            ?->sortByDesc('created_at')
            ->sortByDesc(fn ($item): int => (int) $item->is_default)
            ->first();
        $vehicle = $profile?->vehicles
            ?->sortByDesc('created_at')
            ->sortByDesc(fn ($item): int => $item->status?->value === 'active' ? 1 : 0)
            ->first();
        $profilePresent = $profile
            && filled($profile->first_name)
            && filled($profile->last_name)
            && filled($profile->contact_number)
            && $profile->birth_date;
        $addressPresent = $address
            && filled($address->address_line_1)
            && filled($address->barangay)
            && filled($address->city_municipality)
            && filled($address->province)
            && filled($address->region)
            && filled($address->postal_code);
        $vehiclePresent = $vehicle && $vehicle->status?->value === 'active';
        $hasIdentityDocument = $documents->contains(fn ($document): bool => in_array($document->type, CourierApplicationDetailResource::IDENTITY_DOCUMENT_TYPES, true)
            && $document->status?->value !== 'rejected'
            && filled($document->path));
        $missing = collect([
            'courier_profile' => (bool) $profilePresent,
            'address' => (bool) $addressPresent,
            'vehicle' => (bool) $vehiclePresent,
        ])
            ->reject(fn (bool $present): bool => $present)
            ->keys()
            ->merge(collect(['identity_document' => $hasIdentityDocument])
                ->reject(fn (bool $present): bool => $present)
                ->keys())
            ->merge(collect(CourierApplicationDetailResource::REQUIRED_DOCUMENT_TYPES)
                ->reject(fn (DocumentType $type): bool => $documents->contains(fn ($document): bool => $document->type === $type
                    && $document->status?->value !== 'rejected'
                    && filled($document->path)))
                ->map(fn (DocumentType $type): string => $type->value))
            ->unique()
            ->values()
            ->all();

        return [
            'id' => $this->id,
            'status' => $this->status?->value,
            'created_at' => $this->created_at?->toIso8601String(),
            'courier' => [
                'id' => $this->courier_id,
                'email' => $courier?->email,
                'name' => trim(implode(' ', array_filter([
                    $profile?->first_name,
                    $profile?->middle_name,
                    $profile?->last_name,
                ]))) ?: $courier?->email,
                'account_status' => $courier?->status?->value,
            ],
            'application' => [
                'id' => $application?->id,
                'status' => $application?->status?->value,
                'submitted_at' => $application?->submitted_at?->toIso8601String(),
            ],
            'completeness' => [
                'complete' => $missing === [],
                'missing' => $missing,
            ],
        ];
    }
}
