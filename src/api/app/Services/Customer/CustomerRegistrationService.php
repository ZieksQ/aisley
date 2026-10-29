<?php

namespace App\Services\Customer;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformFeatureControl;
use App\Models\User;
use Illuminate\Support\Arr;

class CustomerRegistrationService
{
    /** Create records inside the email verification completion transaction. */
    public function create(array $data): User
    {
        $control = PlatformFeatureControl::query()
            ->where('key', PlatformFeatureControl::CUSTOMER_REGISTRATION_APPROVAL_REQUIRED)
            ->sharedLock()
            ->first();
        $requiresApproval = $control?->enabled ?? true;
        $user = User::create([
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => UserRole::Customer,
            'status' => $requiresApproval ? UserStatus::Pending : UserStatus::Active,
        ]);
        $user->customerProfile()->create(Arr::only($data, [
            'first_name', 'last_name', 'middle_name', 'contact_number', 'sex', 'birth_date',
        ]));
        $user->registrationApplications()->create([
            'application_type' => UserRole::Customer,
            'status' => $requiresApproval ? ApplicationStatus::Pending : ApplicationStatus::Approved,
            'submitted_at' => now(),
            'reviewed_at' => $requiresApproval ? null : now(),
        ]);

        return $user;
    }
}
