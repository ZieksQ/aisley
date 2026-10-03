<?php

namespace App\Services\Courier;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserStatus;
use App\Models\User;

class CourierAccessService
{
    /** @return array{code: string, message: string}|null */
    public function denial(User $courier): ?array
    {
        if ($courier->status !== UserStatus::Active) {
            return [
                'code' => match ($courier->status) {
                    UserStatus::Pending => 'ACCOUNT_PENDING_APPROVAL',
                    UserStatus::Rejected => 'ACCOUNT_REJECTED',
                    UserStatus::Suspended => 'ACCOUNT_SUSPENDED',
                    UserStatus::Deactivated => 'ACCOUNT_INACTIVE',
                },
                'message' => 'This Courier account is not active.',
            ];
        }

        $affiliation = $courier->courierLogisticsAffiliation()->with('organization.user', 'hub')->first();
        if (! $affiliation || $affiliation->status !== CourierAffiliationStatus::Approved || $affiliation->organization?->user?->status !== UserStatus::Active || ! $affiliation->hub) {
            return [
                'code' => 'LOGISTICS_ASSOCIATION_INVALID',
                'message' => 'This Courier is not approved by an active Logistics organization.',
            ];
        }

        return null;
    }
}
