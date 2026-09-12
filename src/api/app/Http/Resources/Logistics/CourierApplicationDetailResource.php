<?php

namespace App\Http\Resources\Logistics;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Models\CourierLogisticsAffiliation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierApplicationDetailResource extends JsonResource
{
    /** @var array<int, DocumentType> */
    public const REQUIRED_DOCUMENT_TYPES = [
        DocumentType::VehicleRegistration,
    ];

    /** @var array<int, DocumentType> */
    public const IDENTITY_DOCUMENT_TYPES = [
        DocumentType::GovernmentId,
        DocumentType::DriversLicense,
    ];

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var CourierLogisticsAffiliation $affiliation */
        $affiliation = $this->resource;
        /** @var User|null $courier */
        $courier = $affiliation->courier;
        $profile = $courier?->courierProfile;
        $application = $courier?->registrationApplications
            ?->firstWhere('application_type', UserRole::Courier);
        $address = $courier?->addresses
            ?->sortByDesc('created_at')
            ->sortByDesc(fn ($item): int => (int) $item->is_default)
            ->first();
        $vehicle = $profile?->vehicles
            ?->sortByDesc('created_at')
            ->sortByDesc(fn ($item): int => $item->status?->value === 'active' ? 1 : 0)
            ->first();
        $documents = $application?->documents ?? collect();
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
        $hasIdentityDocument = $documents->contains(fn ($document): bool => in_array($document->type, self::IDENTITY_DOCUMENT_TYPES, true)
            && $document->status !== DocumentStatus::Rejected
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
            ->merge(collect(self::REQUIRED_DOCUMENT_TYPES)
                ->reject(fn (DocumentType $type): bool => $documents->contains(fn ($document): bool => $document->type === $type
                    && $document->status !== DocumentStatus::Rejected
                    && filled($document->path)))
                ->map(fn (DocumentType $type): string => $type->value))
            ->unique()
            ->values()
            ->all();

        return [
            'id' => $affiliation->id,
            'status' => $affiliation->status?->value,
            'created_at' => $affiliation->created_at?->toIso8601String(),
            'organization' => [
                'id' => $affiliation->logistics_organization_id,
                'business_name' => $affiliation->organization?->business_name,
                'hub' => $affiliation->hub ? [
                    'id' => $affiliation->logistics_hub_id,
                    'name' => $affiliation->hub->name,
                ] : null,
            ],
            'courier' => [
                'id' => $courier?->id,
                'email' => $courier?->email,
                'account_status' => $courier?->status?->value,
                'profile' => [
                    'first_name' => $profile?->first_name,
                    'middle_name' => $profile?->middle_name,
                    'last_name' => $profile?->last_name,
                    'contact_number' => $profile?->contact_number,
                    'sex' => $profile?->sex?->value,
                    'birth_date' => $profile?->birth_date?->toDateString(),
                    'age' => $profile?->age,
                ],
                'address' => $address ? [
                    'address_line_1' => $address->address_line_1,
                    'address_line_2' => $address->address_line_2,
                    'barangay' => $address->barangay,
                    'city_municipality' => $address->city_municipality,
                    'province' => $address->province,
                    'region' => $address->region,
                    'postal_code' => $address->postal_code,
                    'country' => $address->country,
                ] : null,
                'vehicle' => $vehicle ? [
                    'id' => $vehicle->id,
                    'type' => $vehicle->type?->value,
                    'plate_number' => $vehicle->plate_number,
                    'status' => $vehicle->status?->value,
                ] : null,
            ],
            'application' => $application ? [
                'id' => $application->id,
                'status' => $application->status?->value,
                'submitted_at' => $application->submitted_at?->toIso8601String(),
                'reviewed_at' => $application->reviewed_at?->toIso8601String(),
                'rejection_reason' => $application->rejection_reason,
            ] : null,
            'documents' => $documents->map(fn ($document): array => [
                'id' => $document->id,
                'type' => $document->type?->value,
                'label' => $this->documentLabel($document->type),
                'status' => $document->status?->value,
                'present' => filled($document->path),
                'original_name' => $document->original_name,
                'mime_type' => $document->mime_type,
                'size_bytes' => $document->size_bytes,
                'preview_url' => filled($document->path) ? route('logistics.courier-applications.documents.show', [
                    'affiliation' => $affiliation->id,
                    'document' => $document->id,
                ], false) : null,
            ])->values()->all(),
            'completeness' => [
                'complete' => $missing === [],
                'missing' => $missing,
                'required_documents' => collect([
                    [
                        'type' => 'identity_document',
                        'label' => 'Government ID / driver license',
                        'present' => $hasIdentityDocument,
                    ],
                    ...collect(self::REQUIRED_DOCUMENT_TYPES)->map(fn (DocumentType $type): array => [
                        'type' => $type->value,
                        'label' => $this->documentLabel($type),
                        'present' => $documents->contains(fn ($document): bool => $document->type === $type
                            && $document->status !== DocumentStatus::Rejected
                            && filled($document->path)),
                    ])->values()->all(),
                ])->values()->all(),
                'profile_present' => (bool) $profilePresent,
                'address_present' => (bool) $addressPresent,
                'vehicle_present' => (bool) $vehiclePresent,
            ],
            'review' => $affiliation->reviewed_at ? [
                'reviewed_at' => $affiliation->reviewed_at->toIso8601String(),
                'reason' => $affiliation->rejection_reason,
                'reviewed_by' => $affiliation->reviewer ? [
                    'id' => $affiliation->reviewer->id,
                    'email' => $affiliation->reviewer->email,
                    'name' => $this->reviewerName($affiliation->reviewer),
                ] : null,
            ] : null,
        ];
    }

    private function documentLabel(?DocumentType $type): string
    {
        return match ($type) {
            DocumentType::GovernmentId, DocumentType::DriversLicense => 'Government ID / driver license',
            DocumentType::VehicleRegistration => 'Vehicle OR/CR',
            default => $type?->value ?? 'Document',
        };
    }

    private function reviewerName(User $reviewer): string
    {
        $name = trim(implode(' ', array_filter([
            $reviewer->logisticsProfile?->first_name,
            $reviewer->logisticsProfile?->last_name,
        ])));

        return $name !== '' ? $name : $reviewer->email;
    }
}
