<?php

namespace App\Services\Courier;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CourierAccountService
{
    /** @param array<string, mixed> $attributes */
    public function updateProfile(User $courier, array $attributes): User
    {
        return DB::transaction(function () use ($courier, $attributes): User {
            $lockedCourier = User::query()->lockForUpdate()->findOrFail($courier->id);
            $profile = $lockedCourier->courierProfile()->lockForUpdate()->firstOrFail();
            $profile->fill($attributes)->save();

            return $this->load($lockedCourier);
        });
    }

    public function updatePassword(User $courier, string $currentPassword, string $password): void
    {
        DB::transaction(function () use ($courier, $currentPassword, $password): void {
            $lockedCourier = User::query()->lockForUpdate()->findOrFail($courier->id);

            if (! Hash::check($currentPassword, $lockedCourier->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The password is incorrect.'],
                ]);
            }

            $lockedCourier->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();

            // A password change invalidates every bearer token, including this request's token.
            $lockedCourier->tokens()->delete();
        });
    }

    public function load(User $courier): User
    {
        return $courier->load([
            'courierProfile',
            'courierLogisticsAffiliation.organization',
            'courierLogisticsAffiliation.hub',
        ]);
    }
}
