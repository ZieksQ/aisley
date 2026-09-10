<?php

namespace App\Services\Logistics;

use App\Models\Address;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LogisticsAccountService
{
    /** @param array<string, mixed> $attributes */
    /** @param array<string, string|null> $context */
    public function updateProfile(User $logistics, array $attributes, array $context = []): User
    {
        return DB::transaction(function () use ($logistics, $attributes, $context): User {
            $lockedLogistics = User::query()->lockForUpdate()->findOrFail($logistics->id);
            $profile = $lockedLogistics->logisticsProfile()->lockForUpdate()->firstOrFail();
            $profile->fill($attributes);

            $changedFields = array_keys($profile->getDirty());
            if ($changedFields !== []) {
                $profile->save();
                $this->logMutation($lockedLogistics, 'profile', $changedFields, $context);
            }

            return $this->load($lockedLogistics);
        });
    }

    /** @param array<string, mixed> $attributes */
    /** @param array<string, string|null> $context */
    public function updateOrganization(User $logistics, array $attributes, array $context = []): User
    {
        return DB::transaction(function () use ($logistics, $attributes, $context): User {
            $lockedLogistics = User::query()->lockForUpdate()->findOrFail($logistics->id);
            $organization = $lockedLogistics->logisticsOrganization()->lockForUpdate()->firstOrFail();
            $hub = $organization->hub()->lockForUpdate()->firstOrFail();
            $changedFields = [];

            if (array_key_exists('business_name', $attributes)) {
                $organization->fill(['business_name' => $attributes['business_name']]);
                $changedFields = array_merge($changedFields, array_map(
                    static fn (string $field): string => 'organization.'.$field,
                    array_keys($organization->getDirty()),
                ));
            }

            if (array_key_exists('hub_name', $attributes)) {
                $hub->fill(['name' => $attributes['hub_name']]);
                $changedFields = array_merge($changedFields, array_map(
                    static fn (string $field): string => 'hub.'.$field,
                    array_keys($hub->getDirty()),
                ));
            }

            if ($organization->isDirty()) {
                $organization->save();
            }
            if ($hub->isDirty()) {
                $hub->save();
            }
            if ($changedFields !== []) {
                $this->logMutation($lockedLogistics, 'organization', $changedFields, $context);
            }

            return $this->load($lockedLogistics);
        });
    }

    /** @param array<string, string|null> $context */
    public function updatePassword(User $logistics, string $currentPassword, string $password, array $context = []): void
    {
        DB::transaction(function () use ($logistics, $currentPassword, $password, $context): void {
            $lockedLogistics = User::query()->lockForUpdate()->findOrFail($logistics->id);
            $lockedLogistics->logisticsProfile()->lockForUpdate()->firstOrFail();
            $organization = $lockedLogistics->logisticsOrganization()->lockForUpdate()->firstOrFail();
            $hub = $organization->hub()->lockForUpdate()->firstOrFail();
            $address = $hub->address()->firstOrFail();
            $this->assertAddressOwner($lockedLogistics, $address);

            if (! Hash::check($currentPassword, $lockedLogistics->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The password is incorrect.'],
                ]);
            }

            $lockedLogistics->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();
            $lockedLogistics->tokens()->delete();
            $this->logMutation($lockedLogistics, 'security', ['password'], $context);
        });
    }

    public function load(User $logistics): User
    {
        $loaded = $logistics->load([
            'logisticsProfile',
            'logisticsOrganization.hub.address',
        ]);

        $address = $loaded->logisticsOrganization?->hub?->address;
        if (! $loaded->logisticsProfile || ! $loaded->logisticsOrganization?->hub || ! $address || $address->user_id !== $loaded->id) {
            throw (new ModelNotFoundException)->setModel(User::class, [$logistics->id]);
        }

        return $loaded;
    }

    private function assertAddressOwner(User $logistics, Address $address): void
    {
        if ($address->user_id !== $logistics->id) {
            throw (new ModelNotFoundException)->setModel(User::class, [$logistics->id]);
        }
    }

    /** @param array<int, string> $changedFields */
    /** @param array<string, string|null> $context */
    private function logMutation(User $logistics, string $section, array $changedFields, array $context): void
    {
        Log::info('Logistics account mutation.', [
            'logistics_id' => $logistics->id,
            'feature' => 'logistics_account_management',
            'section' => $section,
            'changed_fields' => array_values(array_unique($changedFields)),
            'request_id' => $context['request_id'] ?? null,
            'ip_address' => $context['ip_address'] ?? null,
            'user_agent' => $context['user_agent'] ?? null,
        ]);
    }
}
