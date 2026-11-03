<?php

namespace App\Services\Customer;

use App\Models\User;
use App\Services\Customer\ProfilePhoto\PhotoProcessor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class CustomerIdImageService
{
    public function __construct(private readonly PhotoProcessor $photos) {}

    /** @param array<string, string|null> $context */
    public function upload(User $customer, UploadedFile $image, array $context): User
    {
        $processed = $this->photos->process($image, 'id_image');
        $bytes = $processed['bytes'];
        unset($processed['bytes']);

        $disk = (string) config('filesystems.default', 'local');
        $this->assertPrivateDisk($disk);
        $path = 'customer-id-images/'.$customer->id.'/'.Str::uuid().'.'.$processed['extension'];
        $oldDisk = null;
        $oldPath = null;

        try {
            if (! Storage::disk($disk)->put($path, $bytes, ['visibility' => 'private'])) {
                throw new RuntimeException('The ID image could not be stored.');
            }

            DB::transaction(function () use ($customer, $disk, $path, $processed, &$oldDisk, &$oldPath): void {
                $profile = $customer->customerProfile()->lockForUpdate()->firstOrFail();
                $oldDisk = $profile->id_image_disk;
                $oldPath = $profile->id_image_path;
                $profile->update([
                    'id_image_disk' => $disk,
                    'id_image_path' => $path,
                    'id_image_mime' => $processed['mime'],
                    'id_image_size' => $processed['size'],
                    'id_image_width' => $processed['width'],
                    'id_image_height' => $processed['height'],
                ]);
            });
        } catch (Throwable $exception) {
            $this->deleteQuietly($disk, $path);
            throw $exception;
        }

        $this->deleteQuietly($oldDisk, $oldPath);
        $this->log($customer, 'uploaded', $processed, $context);

        return $customer->load('customerProfile');
    }

    /** @param array<string, string|null> $context */
    public function remove(User $customer, array $context): User
    {
        $disk = null;
        $path = null;

        DB::transaction(function () use ($customer, &$disk, &$path): void {
            $profile = $customer->customerProfile()->lockForUpdate()->firstOrFail();
            $disk = $profile->id_image_disk;
            $path = $profile->id_image_path;

            if (! $path) {
                return;
            }

            $profile->update([
                'id_image_disk' => null,
                'id_image_path' => null,
                'id_image_mime' => null,
                'id_image_size' => null,
                'id_image_width' => null,
                'id_image_height' => null,
            ]);
        });

        if ($path) {
            $this->deleteQuietly($disk, $path);
            $this->log($customer, 'removed', [], $context);
        }

        return $customer->load('customerProfile');
    }

    private function assertPrivateDisk(string $disk): void
    {
        $configuration = config("filesystems.disks.{$disk}", []);
        $root = $configuration['root'] ?? null;
        $publicRoot = public_path();

        if ($disk === 'public'
            || ($configuration['visibility'] ?? null) === 'public'
            || ($configuration['is_public_container'] ?? false)
            || (is_string($root) && ($root === $publicRoot || str_starts_with($root, $publicRoot.DIRECTORY_SEPARATOR)))) {
            throw new RuntimeException('Private ID image storage is not configured.');
        }
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

    /** @param array<string, mixed> $metadata
     * @param  array<string, string|null>  $context
     */
    private function log(User $customer, string $result, array $metadata, array $context): void
    {
        Log::info('Customer ID image mutation.', [
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
