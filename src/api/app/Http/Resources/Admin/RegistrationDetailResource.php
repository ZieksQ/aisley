<?php

namespace App\Http\Resources\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RegistrationDetailResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->user;
        $profile = match ($this->application_type) {
            UserRole::Customer => $user->customerProfile,
            UserRole::Seller => $user->sellerProfile,
            UserRole::Logistics => $user->logisticsProfile,
            default => null,
        };
        $address = $user->relationLoaded('addresses')
            ? ($user->addresses->firstWhere('is_default', true) ?? $user->addresses->first())
            : null;
        $shop = $this->application_type === UserRole::Seller ? $user->shop : null;
        $organization = $this->application_type === UserRole::Logistics ? $user->logisticsOrganization : null;
        $hubAddress = $organization?->hub?->address;

        return [
            'id' => $this->id,
            'applicant' => [
                'id' => $user->id,
                'name' => $this->displayName($user, $profile),
                'email' => $user->email,
                'role' => $this->application_type->value,
                'account_status' => $user->status->value,
            ],
            'status' => $this->status->value,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'application' => [
                'first_name' => $profile?->first_name,
                'middle_name' => $profile?->middle_name,
                'last_name' => $profile?->last_name,
                'contact_number' => $profile?->contact_number,
                'sex' => $profile?->sex?->value,
                'birth_date' => $profile?->birth_date?->toDateString(),
                'age' => $profile?->age,
                'business' => $shop ? [
                    'name' => $shop->name,
                    'status' => $shop->status->value,
                    'category' => $shop->shopCategory ? [
                        'id' => $shop->shopCategory->id,
                        'name' => $shop->shopCategory->name,
                    ] : null,
                ] : null,
                'logistics_organization' => $organization ? [
                    'business_name' => $organization->business_name,
                    'hub_name' => $organization->hub?->name,
                ] : null,
                'address' => ($hubAddress ?? $address) ? [
                    'address_line_1' => ($hubAddress ?? $address)->address_line_1,
                    'address_line_2' => ($hubAddress ?? $address)->address_line_2,
                    'barangay' => ($hubAddress ?? $address)->barangay,
                    'city_municipality' => ($hubAddress ?? $address)->city_municipality,
                    'province' => ($hubAddress ?? $address)->province,
                    'region' => ($hubAddress ?? $address)->region,
                    'postal_code' => ($hubAddress ?? $address)->postal_code,
                    'country' => ($hubAddress ?? $address)->country,
                ] : null,
            ],
            'documents' => $this->whenLoaded('documents', fn () => $this->documents->map(fn ($document) => [
                'id' => $document->id,
                'type' => $document->type->value,
                'status' => $document->status->value,
                'original_name' => $document->original_name,
                'mime_type' => $document->mime_type,
                'size_bytes' => $document->size_bytes,
                'download_url' => route('admin.registrations.documents.show', [
                    'registration' => $this->id,
                    'document' => $document->id,
                ], false),
                'reviewed_at' => $document->reviewed_at?->toIso8601String(),
                'rejection_reason' => $document->rejection_reason,
            ])),
            'review' => $this->reviewed_at ? [
                'reviewed_at' => $this->reviewed_at->toIso8601String(),
                'rejection_reason' => $this->rejection_reason,
                'reviewed_by' => $this->reviewer ? [
                    'id' => $this->reviewer->id,
                    'name' => $this->reviewerName($this->reviewer),
                ] : null,
            ] : null,
        ];
    }

    private function displayName(User $user, mixed $profile): string
    {
        $name = trim(implode(' ', array_filter([
            $profile?->first_name,
            $profile?->middle_name,
            $profile?->last_name,
        ])));

        return $name !== '' ? $name : $user->email;
    }

    private function reviewerName(User $reviewer): string
    {
        $name = trim(implode(' ', array_filter([
            $reviewer->adminProfile?->first_name,
            $reviewer->adminProfile?->last_name,
        ])));

        return $name !== '' ? $name : $reviewer->email;
    }
}
