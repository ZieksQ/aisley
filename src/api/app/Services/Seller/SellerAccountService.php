<?php

namespace App\Services\Seller;

use App\Models\User;
use App\Services\Account\PasswordChangeVerification;
use App\Services\Customer\ProfilePhoto\ImageRewriter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class SellerAccountService
{
    public function updateProfile(User $seller, array $attributes, array $context): User
    {
        return DB::transaction(function () use ($seller, $attributes, $context): User {
            $profile = $seller->sellerProfile()->lockForUpdate()->firstOrFail();
            $changedFields = $this->changedFields($profile, $attributes);
            $profile->fill($attributes)->save();
            $this->securityLog($seller, 'seller_account.profile_updated', $changedFields, $context);

            return $this->load($seller);
        });
    }

    public function updateStorefront(User $seller, array $attributes, array $context): User
    {
        return DB::transaction(function () use ($seller, $attributes, $context): User {
            $shop = $seller->shop()->lockForUpdate()->firstOrFail();
            $changedFields = $this->changedFields($shop, $attributes);
            $shop->fill($attributes)->save();
            $this->securityLog($seller, 'seller_account.storefront_updated', $changedFields, $context);

            return $this->load($seller);
        });
    }

    public function updateEmail(User $seller, string $email, array $context): User
    {
        return DB::transaction(function () use ($seller, $email, $context): User {
            if ($seller->email !== $email) {
                $seller->update(['email' => $email]);
                $this->securityLog($seller, 'seller_account.email_updated', ['email'], $context);
            }

            return $this->load($seller);
        });
    }

    public function updatePassword(User $seller, string $currentPassword, string $password, array $context, string $challengeId, string $code): void
    {
        app(PasswordChangeVerification::class)->complete($seller, $currentPassword, $password, $challengeId, $code, function (User $seller) use ($password, $context): void {
            $seller->update(['password' => $password]);
            $seller->tokens()->delete();
            $this->securityLog($seller, 'seller_account.password_updated', ['password'], $context);
        });
    }

    public function updateProfilePhoto(User $seller, UploadedFile $photo, array $context): User
    {
        $metadata = $this->inspectImage($photo);
        $disk = (string) config('filesystems.default', 'local');
        $path = $photo->storeAs(
            'seller-profile-photos/'.$seller->id,
            Str::uuid().'.'.$metadata['extension'],
            $disk,
        );

        if (! is_string($path) || $path === '') {
            throw new RuntimeException('The profile photo could not be stored.');
        }

        $oldDisk = null;
        $oldPath = null;

        try {
            DB::transaction(function () use ($seller, $disk, $path, $metadata, $context, &$oldDisk, &$oldPath): void {
                $profile = $seller->sellerProfile()->lockForUpdate()->firstOrFail();
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
                $this->securityLog($seller, 'seller_account.profile_photo_updated', ['profile_photo'], $context);
            });
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }

        $this->deleteQuietly($oldDisk, $oldPath);

        return $this->load($seller);
    }

    public function removeProfilePhoto(User $seller, array $context): User
    {
        $disk = null;
        $path = null;

        DB::transaction(function () use ($seller, $context, &$disk, &$path): void {
            $profile = $seller->sellerProfile()->lockForUpdate()->firstOrFail();
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
            $this->securityLog($seller, 'seller_account.profile_photo_removed', ['profile_photo'], $context);
        });

        $this->deleteQuietly($disk, $path);

        return $this->load($seller);
    }

    public function updateShopCover(User $seller, UploadedFile $photo, array $context): User
    {
        $source = file_get_contents($photo->getRealPath(), false, null, 0, ImageRewriter::MAX_BYTES);
        if (! is_string($source) || strlen($source) >= ImageRewriter::MAX_BYTES) {
            throw ValidationException::withMessages(['photo' => 'The Shop cover must be smaller than 10 MiB.']);
        }
        $rewriter = new ImageRewriter;
        try {
            $metadata = $rewriter->inspect($source);
            $parts = explode('.', basename(str_replace('\\', '/', $photo->getClientOriginalName())));
            $extension = strtolower(end($parts));
            $extension = $extension === 'jpeg' ? 'jpg' : $extension;
            if (count($parts) !== 2 || $extension !== $metadata['extension']) {
                throw ValidationException::withMessages(['photo' => 'The Shop cover filename must have one extension matching its image type.']);
            }
            $bytes = $rewriter->rewrite($source);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages(['photo' => [$exception->getMessage()]]);
        }
        unset($source);
        $metadata = $rewriter->inspect($bytes);
        $disk = (string) config('filesystems.default', 'local');
        $path = 'shop-covers/'.$seller->id.'/'.Str::uuid().'.'.$metadata['extension'];
        if (! Storage::disk($disk)->put($path, $bytes)) {
            throw new RuntimeException('The Shop cover could not be stored.');
        }
        unset($bytes);

        $oldDisk = null;
        $oldPath = null;
        try {
            DB::transaction(function () use ($seller, $disk, $path, $metadata, $context, &$oldDisk, &$oldPath): void {
                $shop = $seller->shop()->lockForUpdate()->firstOrFail();
                $oldDisk = $shop->banner_disk;
                $oldPath = $shop->banner_path;
                $shop->update([
                    'banner_disk' => $disk,
                    'banner_path' => $path,
                    'banner_mime' => $metadata['mime'],
                    'banner_size' => $metadata['size'],
                    'banner_width' => $metadata['width'],
                    'banner_height' => $metadata['height'],
                    'banner_version' => (string) Str::uuid(),
                ]);
                $this->securityLog($seller, 'seller_account.shop_cover_updated', ['shop_cover'], $context);
            });
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }
        $this->deleteQuietly($oldDisk, $oldPath);

        return $this->load($seller);
    }

    public function removeShopCover(User $seller, array $context): User
    {
        $disk = null;
        $path = null;
        DB::transaction(function () use ($seller, $context, &$disk, &$path): void {
            $shop = $seller->shop()->lockForUpdate()->firstOrFail();
            if (! $shop->banner_path) {
                return;
            }
            $disk = $shop->banner_disk;
            $path = $shop->banner_path;
            $shop->update([
                'banner_disk' => null,
                'banner_path' => null,
                'banner_mime' => null,
                'banner_size' => null,
                'banner_width' => null,
                'banner_height' => null,
                'banner_version' => null,
            ]);
            $this->securityLog($seller, 'seller_account.shop_cover_removed', ['shop_cover'], $context);
        });
        $this->deleteQuietly($disk, $path);

        return $this->load($seller);
    }

    private function inspectImage(UploadedFile $photo): array
    {
        $dimensions = @getimagesize($photo->getRealPath());
        if ($dimensions === false || ! isset($dimensions['mime'])) {
            throw ValidationException::withMessages(['photo' => 'The profile photo is not a valid image.']);
        }

        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $mime = (string) $dimensions['mime'];
        if (! isset($allowed[$mime])) {
            throw ValidationException::withMessages(['photo' => 'The profile photo must be a JPEG, PNG, or WebP image.']);
        }

        $clientExtension = strtolower($photo->getClientOriginalExtension());
        if ($clientExtension === 'jpeg') {
            $clientExtension = 'jpg';
        }
        if ($clientExtension !== $allowed[$mime]) {
            throw ValidationException::withMessages(['photo' => 'The profile photo extension does not match its image type.']);
        }

        return [
            'mime' => $mime,
            'extension' => $allowed[$mime],
            'size' => (int) $photo->getSize(),
            'width' => (int) $dimensions[0],
            'height' => (int) $dimensions[1],
        ];
    }

    private function load(User $seller): User
    {
        return $seller->load(['sellerProfile', 'shop.shopCategory']);
    }

    private function changedFields($model, array $attributes): array
    {
        return array_values(array_filter(array_keys($attributes), fn (string $field): bool => $model->getAttribute($field) != $attributes[$field]));
    }

    private function securityLog(User $seller, string $action, array $changedFields, array $context): void
    {
        if ($changedFields === []) {
            return;
        }

        Log::info('Seller account mutation.', [
            'seller_id' => $seller->id,
            'action' => $action,
            'changed_fields' => $changedFields,
            'request_id' => $context['request_id'] ?? null,
            'ip_address' => $context['ip_address'] ?? null,
        ]);
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
}
