<?php

namespace App\Services\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class AdminAccountService
{
    public function __construct(private readonly AuditService $auditService) {}

    public function updateProfile(User $admin, array $attributes, array $context): User
    {
        return DB::transaction(function () use ($admin, $attributes, $context): User {
            $profile = $admin->adminProfile()->firstOrNew();
            $changedFields = [];
            foreach ($attributes as $field => $value) {
                if ($profile->getAttribute($field) != $value) {
                    $changedFields[] = $field;
                }
            }
            $profile->fill($attributes)->save();

            if ($changedFields !== []) {
                $this->audit($admin, AdminAuditAction::AdminProfileUpdated, $context, [
                    'changed_fields' => $changedFields,
                ]);
            }

            return $admin->load('adminProfile');
        });
    }

    public function updateEmail(User $admin, string $email, array $context): User
    {
        return DB::transaction(function () use ($admin, $email, $context): User {
            if ($admin->email !== $email) {
                $admin->update(['email' => $email]);
                $this->audit($admin, AdminAuditAction::AdminEmailUpdated, $context, [
                    'changed_fields' => ['email'],
                ]);
            }

            return $admin->load('adminProfile');
        });
    }

    public function updatePassword(User $admin, string $password, array $context): void
    {
        DB::transaction(function () use ($admin, $password, $context): void {
            $admin->update(['password' => $password]);
            $this->audit($admin, AdminAuditAction::AdminPasswordUpdated, $context, [
                'changed_fields' => ['password'],
            ]);
        });
    }

    public function updateProfilePhoto(User $admin, UploadedFile $photo, array $context): User
    {
        $profile = $admin->adminProfile()->firstOrFail();
        $metadata = $this->inspectImage($photo);
        $disk = (string) config('filesystems.default', 'local');
        $path = $photo->storeAs(
            'admin-profile-photos/'.$admin->id,
            Str::uuid().'.'.$metadata['extension'],
            $disk,
        );

        if (! is_string($path) || $path === '') {
            throw new RuntimeException('The profile photo could not be stored.');
        }

        $oldDisk = $profile->profile_photo_disk;
        $oldPath = $profile->profile_photo_path;

        try {
            DB::transaction(function () use ($admin, $profile, $disk, $path, $metadata, $context): void {
                $profile->update([
                    'profile_photo_disk' => $disk,
                    'profile_photo_path' => $path,
                    'profile_photo_mime' => $metadata['mime'],
                    'profile_photo_size' => $metadata['size'],
                    'profile_photo_width' => $metadata['width'],
                    'profile_photo_height' => $metadata['height'],
                ]);
                $this->audit($admin, AdminAuditAction::AdminProfilePhotoUpdated, $context, [
                    'changed_fields' => ['profile_photo'],
                ]);
            });
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }

        if ($oldDisk && $oldPath) {
            try {
                Storage::disk($oldDisk)->delete($oldPath);
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $admin->load('adminProfile');
    }

    public function removeProfilePhoto(User $admin, array $context): User
    {
        $profile = $admin->adminProfile()->firstOrFail();
        $disk = $profile->profile_photo_disk;
        $path = $profile->profile_photo_path;

        if (! $path) {
            return $admin->load('adminProfile');
        }

        DB::transaction(function () use ($admin, $profile, $context): void {
            $profile->update([
                'profile_photo_disk' => null,
                'profile_photo_path' => null,
                'profile_photo_mime' => null,
                'profile_photo_size' => null,
                'profile_photo_width' => null,
                'profile_photo_height' => null,
            ]);
            $this->audit($admin, AdminAuditAction::AdminProfilePhotoRemoved, $context, [
                'changed_fields' => ['profile_photo'],
            ]);
        });

        if ($disk && $path) {
            try {
                Storage::disk($disk)->delete($path);
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $admin->load('adminProfile');
    }

    private function inspectImage(UploadedFile $photo): array
    {
        $dimensions = @getimagesize($photo->getRealPath());
        if ($dimensions === false || ! isset($dimensions['mime'])) {
            throw ValidationException::withMessages(['photo' => 'The profile photo is not a valid image.']);
        }

        $allowed = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];
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

    private function audit(User $admin, AdminAuditAction $action, array $context, array $metadata): void
    {
        $this->auditService->record(
            actor: $admin,
            action: $action,
            sourceFeature: AuditSourceFeature::AdminAccountManagement,
            target: $admin,
            targetSnapshot: ['admin_id' => $admin->id, 'role' => $admin->role->value],
            metadata: $metadata,
            ipAddress: $context['ip_address'] ?? null,
            userAgent: $context['user_agent'] ?? null,
            requestId: $context['request_id'] ?? null,
        );
    }
}
