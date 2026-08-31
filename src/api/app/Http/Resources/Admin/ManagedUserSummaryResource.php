<?php

namespace App\Http\Resources\Admin;

use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class ManagedUserSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'display_name' => $this->displayName(),
            'email' => $this->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'created_at' => $this->created_at?->toIso8601String(),
            'status_changed_at' => $this->statusChangedAt(),
        ];
    }

    protected function displayName(): string
    {
        $profile = match ($this->role) {
            UserRole::Customer => $this->customerProfile,
            UserRole::Seller => $this->sellerProfile,
            UserRole::Courier => $this->courierProfile,
            UserRole::Admin => null,
        };
        $name = trim(implode(' ', array_filter([
            $profile?->first_name,
            $profile?->middle_name,
            $profile?->last_name,
        ])));

        return $name !== '' ? $name : $this->email;
    }

    private function statusChangedAt(): ?string
    {
        $value = $this->getAttribute('status_changed_at');

        return $value ? Carbon::parse($value)->toIso8601String() : null;
    }
}
