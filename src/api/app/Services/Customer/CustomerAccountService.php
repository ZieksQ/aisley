<?php

namespace App\Services\Customer;

use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

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

    /** @param array<string, mixed> $context */
    public function updateProfilePhoto(User $customer, UploadedFile $photo, array $context): User
    {
        $metadata = $this->inspectImage($photo);
        $disk = (string) config('filesystems.default', 'local');
        $path = $photo->storeAs(
            'customer-profile-photos/'.$customer->id,
            Str::uuid().'.'.$metadata['extension'],
            $disk,
        );

        if (! is_string($path) || $path === '') {
            throw new RuntimeException('The profile photo could not be stored.');
        }

        $oldDisk = null;
        $oldPath = null;

        try {
            DB::transaction(function () use ($customer, $disk, $path, $metadata, &$oldDisk, &$oldPath): void {
                $profile = $customer->customerProfile()->lockForUpdate()->firstOrFail();
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
        $this->photoLog($customer, 'uploaded', $metadata, $context);

        return $this->load($customer);
    }

    /** @param array<string, mixed> $context */
    public function removeProfilePhoto(User $customer, array $context): User
    {
        $disk = null;
        $path = null;

        DB::transaction(function () use ($customer, &$disk, &$path): void {
            $profile = $customer->customerProfile()->lockForUpdate()->firstOrFail();
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
            $this->photoLog($customer, 'removed', [], $context);
        }

        return $this->load($customer);
    }

    public function load(User $customer): User
    {
        return $customer->load('customerProfile');
    }

    /** @return array{mime: string, extension: string, size: int, width: int, height: int} */
    private function inspectImage(UploadedFile $photo): array
    {
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
            'size' => (int) $photo->getSize(),
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

    /**
     * @param  array<string, mixed>  $metadata
     * @param  array<string, mixed>  $context
     */
    private function photoLog(User $customer, string $result, array $metadata, array $context): void
    {
        Log::info('Customer profile photo mutation.', [
            'customer_id' => $customer->id,
            'feature' => 'customer_account_management',
            'result' => $result,
            'mime' => $metadata['mime'] ?? null,
            'size' => $metadata['size'] ?? null,
            'request_id' => $context['request_id'] ?? null,
            'ip_address' => $context['ip_address'] ?? null,
        ]);
    }
}
