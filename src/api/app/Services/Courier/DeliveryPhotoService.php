<?php

namespace App\Services\Courier;

use App\Enums\FulfillmentTaskStatus;
use App\Enums\ShipmentEvidencePurpose;
use App\Enums\ShipmentEvidenceStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\FinalMileFailedAttempt;
use App\Models\ShipmentEvidence;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\LogisticsNotificationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class DeliveryPhotoService
{
    public function __construct(
        private readonly FulfillmentTransitionService $fulfillment,
        private readonly LogisticsNotificationService $notifications,
    ) {}

    public function submit(User $courier, string $taskId, UploadedFile $photo, int $revision, string $key): ShipmentEvidence
    {
        $meta = $this->inspect($photo);
        $hash = hash_file('sha256', $photo->getRealPath());
        $requestHash = hash('sha256', json_encode([$taskId, $revision, $hash], JSON_THROW_ON_ERROR));
        $path = null;
        $disk = 'local'; // The configured local disk is rooted at storage/app/private.

        try {
            return DB::transaction(function () use ($courier, $taskId, $photo, $revision, $key, $meta, $hash, $requestHash, $disk, &$path): ShipmentEvidence {
                $prior = ShipmentEvidence::query()->where('courier_id', $courier->id)->where('idempotency_key', $key)->lockForUpdate()->first();
                if ($prior !== null) {
                    if (! hash_equals($prior->request_hash, $requestHash)) {
                        throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This key was used for a different delivery photo.');
                    }

                    return $prior->load('task');
                }
                $task = $this->fulfillment->ownedFinalTask($courier, $taskId, true);
                if ($task->revision !== $revision || $task->status !== FulfillmentTaskStatus::OutForDelivery) {
                    throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'Refresh this delivery before submitting a photo.');
                }
                if ($task->completionIntents()->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)->exists()) {
                    throw FulfillmentException::conflict('COMPLETION_PENDING', 'Logistics is already reviewing this delivery.');
                }
                $path = $photo->storeAs('delivery-proofs/'.$task->id, Str::uuid().'.'.$meta['extension'], $disk);
                if (! is_string($path) || $path === '') {
                    throw ValidationException::withMessages(['photo' => ['The delivery photo could not be stored.']]);
                }
                $offer = $task->offers()->where('courier_id', $courier->id)->where('status', 'accepted')->latest('sequence')->first();
                $evidence = ShipmentEvidence::create([
                    'delivery_task_id' => $task->id,
                    'delivery_task_offer_id' => $offer?->id,
                    'waybill_id' => $task->shipment->parcel->waybill_id,
                    'courier_id' => $courier->id,
                    'purpose' => ShipmentEvidencePurpose::DeliveryProof,
                    'type' => 'photo',
                    'status' => ShipmentEvidenceStatus::AwaitingValidation,
                    'idempotency_key' => $key,
                    'request_hash' => $requestHash,
                    'correlation_id' => (string) Str::uuid(),
                    'storage_disk' => $disk,
                    'storage_path' => $path,
                    'mime_type' => $meta['mime'],
                    'byte_size' => $meta['size'],
                    'image_width' => $meta['width'],
                    'image_height' => $meta['height'],
                    'sha256' => $hash,
                    'metadata' => ['failed_attempt_count' => FinalMileFailedAttempt::query()->where('delivery_task_id', $task->id)->count()],
                    'submitted_at' => now(),
                ]);
                $this->notifications->queueEvidenceSubmitted($evidence);

                return $evidence->load('task');
            }, 3);
        } catch (Throwable $exception) {
            if (is_string($path) && $path !== '') {
                Storage::disk($disk)->delete($path);
            }
            throw $exception;
        }
    }

    private function inspect(UploadedFile $photo): array
    {
        $dimensions = @getimagesize($photo->getRealPath());
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $mime = $dimensions['mime'] ?? null;
        $extension = strtolower($photo->getClientOriginalExtension());
        if ($extension === 'jpeg') {
            $extension = 'jpg';
        }
        if ($photo->getSize() >= 10 * 1024 * 1024 || ! isset($allowed[$mime]) || $extension !== $allowed[$mime]
            || ($dimensions[0] ?? 0) < 1 || ($dimensions[1] ?? 0) < 1 || ($dimensions[0] * $dimensions[1]) > 40000000) {
            throw ValidationException::withMessages(['photo' => ['Use a valid JPEG, PNG, or WebP photo smaller than 10 MB.']]);
        }
        $decoded = @imagecreatefromstring(file_get_contents($photo->getRealPath()));
        if ($decoded === false) {
            throw ValidationException::withMessages(['photo' => ['The delivery photo cannot be decoded.']]);
        }
        unset($decoded);

        return ['mime' => $mime, 'extension' => $extension, 'size' => $photo->getSize(), 'width' => $dimensions[0], 'height' => $dimensions[1]];
    }
}
