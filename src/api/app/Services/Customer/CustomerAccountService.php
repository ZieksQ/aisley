<?php

namespace App\Services\Customer;

use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerAccountService
{
    /** @param array<string, mixed> $attributes */
    public function updateProfile(User $customer, array $attributes): User
    {
        return DB::transaction(function () use ($customer, $attributes): User {
            $lockedCustomer = User::query()->lockForUpdate()->findOrFail($customer->id);
            $profile = $lockedCustomer->customerProfile()->lockForUpdate()->firstOrFail();
            $profile->fill($attributes)->save();

            return $this->load($lockedCustomer);
        });
    }

    public function updatePassword(
        User $customer,
        string $currentPassword,
        string $password,
        ?PersonalAccessToken $currentToken,
    ): void {
        DB::transaction(function () use ($customer, $currentPassword, $password, $currentToken): void {
            $lockedCustomer = User::query()->lockForUpdate()->findOrFail($customer->id);
            if (! Hash::check($currentPassword, $lockedCustomer->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The password is incorrect.'],
                ]);
            }

            $lockedCustomer->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();

            $tokens = $lockedCustomer->tokens();
            if ($currentToken?->getKey()) {
                $tokens->whereKeyNot($currentToken->getKey());
            }
            $tokens->delete();
        });
    }

    public function load(User $customer): User
    {
        return $customer->load('customerProfile');
    }
}
