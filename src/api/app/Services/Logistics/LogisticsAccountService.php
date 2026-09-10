<?php

namespace App\Services\Logistics;

use App\Models\Address;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

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

    /** @param array<string, string|null> $context */
    public function updateProfilePhoto(User $logistics, UploadedFile $photo, array $context): User
    {
        // Keep photo mutations fail-closed when the authenticated account's
        // required Logistics organization, hub, or address projection is
        // incomplete or no longer belongs to the account.
        $this->load($logistics);
        $metadata = $this->inspectImage($photo);
        $disk = (string) config('filesystems.default', 'local');
        $path = $photo->storeAs(
            'logistics-profile-photos/'.$logistics->id,
            Str::uuid().'.'.$metadata['extension'],
            $disk,
        );

        if (! is_string($path) || $path === '') {
            throw new RuntimeException('The profile photo could not be stored.');
        }

        $oldDisk = null;
        $oldPath = null;

        try {
            DB::transaction(function () use ($logistics, $disk, $path, $metadata, &$oldDisk, &$oldPath): void {
                $lockedLogistics = User::query()->lockForUpdate()->findOrFail($logistics->id);
                $profile = $lockedLogistics->logisticsProfile()->lockForUpdate()->firstOrFail();
                $oldDisk = $profile->profile_photo_disk;
                $oldPath = $profile->profile_photo_path;
                $profile->update([
                    'profile_photo_disk' => $disk,
                    'profile_photo_path' => $path,
                    'profile_photo_mime' => $metadata['mime'],
                    'profile_photo_size' => $metadata['size'],
                    'profile_photo_width' => $metadata['width'],
                    'profile_photo_height' => $metadata['height'],
                ]);
            });
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }

        $this->deleteQuietly($oldDisk, $oldPath);
        $this->photoLog($logistics, 'uploaded', $metadata, $context);

        return $this->load($logistics);
    }

    /** @param array<string, string|null> $context */
    public function removeProfilePhoto(User $logistics, array $context): User
    {
        $this->load($logistics);
        $disk = null;
        $path = null;

        DB::transaction(function () use ($logistics, &$disk, &$path): void {
            $lockedLogistics = User::query()->lockForUpdate()->findOrFail($logistics->id);
            $profile = $lockedLogistics->logisticsProfile()->lockForUpdate()->firstOrFail();
            $disk = $profile->profile_photo_disk;
            $path = $profile->profile_photo_path;

            if (! $path) {
                return;
            }

            $profile->update([
                'profile_photo_disk' => null,
                'profile_photo_path' => null,
                'profile_photo_mime' => null,
                'profile_photo_size' => null,
                'profile_photo_width' => null,
                'profile_photo_height' => null,
            ]);
        });

        if ($path) {
            $this->deleteQuietly($disk, $path);
            $this->photoLog($logistics, 'removed', [], $context);
        }

        return $this->load($logistics);
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

    /** @return array{mime: string, extension: string, size: int, width: int, height: int} */
    private function inspectImage(UploadedFile $photo): array
    {
        $size = (int) $photo->getSize();
        if ($size >= 10 * 1024 * 1024) {
            throw ValidationException::withMessages([
                'photo' => ['The profile photo must be smaller than 10 MB.'],
            ]);
        }

        $dimensions = @getimagesize($photo->getRealPath());
        if ($dimensions === false || ! isset($dimensions['mime'])) {
            throw ValidationException::withMessages([
                'photo' => ['The profile photo is not a valid image.'],
            ]);
        }

        $allowed = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];
        $mime = (string) $dimensions['mime'];
        if (! isset($allowed[$mime])) {
            throw ValidationException::withMessages([
                'photo' => ['The profile photo must be a JPEG, PNG, or WebP image.'],
            ]);
        }

        $clientExtension = strtolower($photo->getClientOriginalExtension());
        if ($clientExtension === 'jpeg') {
            $clientExtension = 'jpg';
        }
        if ($clientExtension !== $allowed[$mime]) {
            throw ValidationException::withMessages([
                'photo' => ['The profile photo extension does not match its image type.'],
            ]);
        }

        return [
            'mime' => $mime,
            'extension' => $allowed[$mime],
            'size' => $size,
            'width' => (int) $dimensions[0],
            'height' => (int) $dimensions[1],
        ];
    }

    private function deleteQuietly(?string $disk, ?string $path): void
    {
        if (! $disk || ! $path) {
            return;
        }

        try {
            Storage::disk($disk)->delete($path);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    /** @param array<string, mixed> $metadata */
    /** @param array<string, string|null> $context */
    private function photoLog(User $logistics, string $result, array $metadata, array $context): void
    {
        Log::info('Logistics profile photo mutation.', [
            'logistics_id' => $logistics->id,
            'feature' => 'logistics_account_management',
            'result' => $result,
            'mime' => $metadata['mime'] ?? null,
            'size' => $metadata['size'] ?? null,
            'request_id' => $context['request_id'] ?? null,
            'ip_address' => $context['ip_address'] ?? null,
            'user_agent' => $context['user_agent'] ?? null,
        ]);
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
