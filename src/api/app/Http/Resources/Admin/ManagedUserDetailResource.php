<?php

namespace App\Http\Resources\Admin;

use App\Enums\UserRole;
use Illuminate\Http\Request;

class ManagedUserDetailResource extends ManagedUserSummaryResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $profile = match ($this->role) {
            UserRole::Customer => $this->customerProfile,
            UserRole::Seller => $this->sellerProfile,
            UserRole::Courier => $this->courierProfile,
            UserRole::Admin => null,
        };
        $registration = $this->registrationApplications->sortByDesc('submitted_at')->first();

        return [
            ...parent::toArray($request),
            'profile' => [
                'first_name' => $profile?->first_name,
                'middle_name' => $profile?->middle_name,
                'last_name' => $profile?->last_name,
                'contact_number' => $this->maskedContact($profile?->contact_number),
            ],
            'registration' => $registration ? [
                'id' => $registration->id,
                'status' => $registration->status->value,
                'submitted_at' => $registration->submitted_at?->toIso8601String(),
                'reviewed_at' => $registration->reviewed_at?->toIso8601String(),
            ] : null,
            'role_summary' => match ($this->role) {
                UserRole::Seller => $this->shop ? [
                    'shop_id' => $this->shop->id,
                    'shop_name' => $this->shop->name,
                    'shop_status' => $this->shop->status->value,
                ] : null,
                UserRole::Courier => [
                    'vehicle_count' => $this->courierProfile?->vehicles_count ?? 0,
                ],
                default => null,
            },
        ];
    }

    private function maskedContact(?string $contact): ?string
    {
        if (! $contact) {
            return null;
        }

        $visible = mb_substr($contact, -4);

        return str_repeat('•', max(0, mb_strlen($contact) - 4)).$visible;
    }
}
