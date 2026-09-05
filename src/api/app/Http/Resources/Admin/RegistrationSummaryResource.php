<?php

namespace App\Http\Resources\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RegistrationSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->user;

        return [
            'id' => $this->id,
            'applicant' => [
                'id' => $user->id,
                'name' => $this->displayName($user),
                'email' => $user->email,
            ],
            'role' => $this->application_type->value,
            'status' => $this->status->value,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }

    private function displayName(User $user): string
    {
        $profile = match ($this->application_type) {
            UserRole::Customer => $user->customerProfile,
            UserRole::Seller => $user->sellerProfile,
            UserRole::Logistics => $user->logisticsProfile,
            default => null,
        };

        $name = trim(implode(' ', array_filter([
            $profile?->first_name,
            $profile?->middle_name,
            $profile?->last_name,
        ])));

        return $name !== '' ? $name : $user->email;
    }
}
