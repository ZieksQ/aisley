<?php

namespace App\Services\Courier;

use App\Enums\CourierAffiliationStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Courier\CourierVehicleException;
use App\Models\CourierVehicleMutation;
use App\Models\Document;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Logistics\LogisticsNotificationService;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class CourierVehicleService
{
    public function __construct(private readonly LogisticsNotificationService $notifications) {}

    /** @return array<string, mixed> */
    public function show(User $courier): array
    {
        return $this->projection($this->soleVehicle($courier));
    }

    /** @return array<string, mixed> */
    public function update(User $courier, array $attributes, string $idempotencyKey): array
    {
        $hash = $this->hash(['action' => 'update', 'attributes' => $attributes]);

        return DB::transaction(function () use ($courier, $attributes, $idempotencyKey, $hash): array {
            $vehicle = $this->soleVehicle($courier, true);
            $previous = CourierVehicleMutation::query()
                ->where('courier_id', $courier->id)
                ->where('vehicle_id', $vehicle->id)
                ->where('action', 'update')
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous) {
                $this->assertReplay($previous, $hash);

                return $previous->response;
            }

            $this->assertRevision($vehicle, (int) $attributes['expected_revision']);
            $changed = false;
            $changedFields = [];
            foreach (['vehicle_type' => 'type', 'plate_number' => 'plate_number', 'make' => 'make', 'model' => 'model'] as $input => $column) {
                if (! array_key_exists($input, $attributes)) {
                    continue;
                }
                $value = $input === 'vehicle_type' ? $attributes[$input] : $attributes[$input];
                $current = $column === 'type' ? $vehicle->type?->value : $vehicle->{$column};
                if ($column === 'plate_number' && $current !== $value && Vehicle::query()->where('plate_number', $value)->whereKeyNot($vehicle->id)->exists()) {
                    throw CourierVehicleException::conflict('PLATE_NUMBER_TAKEN', 'That plate number is already registered to another vehicle.', 'plate_number');
                }
                if ($current !== $value) {
                    $changed = true;
                    $changedFields[] = $input;
                    $vehicle->{$column} = $value;
                }
            }
            if ($changed) {
                $vehicle->revision = (int) $vehicle->revision + 1;
                try {
                    $vehicle->save();
                } catch (QueryException $exception) {
                    if (str_contains(strtolower($exception->getMessage()), 'plate_number')) {
                        throw CourierVehicleException::conflict('PLATE_NUMBER_TAKEN', 'That plate number is already registered to another vehicle.', 'plate_number');
                    }
                    throw $exception;
                }
            }

            $projection = $this->projection($vehicle->fresh(['officialReceiptDocument', 'certificateOfRegistrationDocument']));
            CourierVehicleMutation::create([
                'courier_id' => $courier->id,
                'vehicle_id' => $vehicle->id,
                'action' => 'update',
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $hash,
                'resulting_revision' => $vehicle->revision,
                'response' => $projection,
            ]);
            if ($changed) {
                $this->notifyAfterCommit($vehicle->id, $courier->id, (int) $vehicle->revision, $changedFields);
            }

            return $projection;
        }, 3);
    }

    /** @return array<string, mixed> */
    public function replaceDocument(User $courier, string $kind, UploadedFile $file, int $expectedRevision, string $idempotencyKey): array
    {
        $documentType = $this->documentType($kind);
        $checksum = hash_file('sha256', $file->getRealPath()) ?: null;
        $hash = $this->hash([
            'action' => 'document',
            'kind' => $kind,
            'expected_revision' => $expectedRevision,
            'checksum' => $checksum,
            'size' => $file->getSize(),
        ]);
        $stored = null;
        $oldDocumentId = null;
        try {
            $result = DB::transaction(function () use ($courier, $kind, $documentType, $file, $expectedRevision, $idempotencyKey, $hash, $checksum, &$stored, &$oldDocumentId): array {
                $vehicle = $this->soleVehicle($courier, true);
                $previous = CourierVehicleMutation::query()
                    ->where('courier_id', $courier->id)
                    ->where('vehicle_id', $vehicle->id)
                    ->where('action', 'document:'.$kind)
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();
                if ($previous) {
                    $this->assertReplay($previous, $hash);

                    return $previous->response;
                }

                $this->assertRevision($vehicle, $expectedRevision);
                $metadata = $this->inspectImage($file);
                $disk = (string) config('courier.registration.evidence_disk', config('filesystems.default', 'local'));
                $extension = $metadata['extension'];
                $path = $file->storeAs('courier-vehicle-documents/'.$courier->id, Str::uuid().'.'.$extension, $disk);
                if (! is_string($path) || $path === '') {
                    throw new CourierVehicleException('DOCUMENT_STORAGE_UNAVAILABLE', 'The vehicle document could not be stored.', 503);
                }
                $stored = [$disk, $path];

                $oldDocumentId = $kind === 'official_receipt'
                    ? $vehicle->official_receipt_document_id
                    : $vehicle->certificate_of_registration_document_id;
                $document = Document::create([
                    'user_id' => $courier->id,
                    'registration_application_id' => null,
                    'type' => $documentType,
                    'status' => DocumentStatus::Verified,
                    'disk' => $disk,
                    'path' => $path,
                    'original_name' => Str::limit($file->getClientOriginalName(), 255, ''),
                    'mime_type' => $metadata['mime'],
                    'size_bytes' => $metadata['size'],
                    'checksum' => $checksum,
                ]);
                if ($kind === 'official_receipt') {
                    $vehicle->official_receipt_document_id = $document->id;
                } else {
                    $vehicle->certificate_of_registration_document_id = $document->id;
                }
                $vehicle->revision = (int) $vehicle->revision + 1;
                $vehicle->save();

                $projection = $this->projection($vehicle->fresh(['officialReceiptDocument', 'certificateOfRegistrationDocument']));
                CourierVehicleMutation::create([
                    'courier_id' => $courier->id,
                    'vehicle_id' => $vehicle->id,
                    'action' => 'document:'.$kind,
                    'idempotency_key' => $idempotencyKey,
                    'request_hash' => $hash,
                    'resulting_revision' => $vehicle->revision,
                    'response' => $projection,
                ]);
                $this->notifyAfterCommit($vehicle->id, $courier->id, (int) $vehicle->revision, [$kind]);
                if ($oldDocumentId) {
                    DB::afterCommit(fn () => $this->cleanupDocument($oldDocumentId));
                }

                return $projection;
            }, 3);
        } catch (Throwable $exception) {
            if (is_array($stored)) {
                try {
                    Storage::disk($stored[0])->delete($stored[1]);
                } catch (Throwable) {
                    // Cleanup is best effort; the failed mutation remains non-committed.
                }
            }
            throw $exception;
        }

        return $result;
    }

    public function documentForCourier(User $courier, string $kind): Document
    {
        $vehicle = $this->soleVehicle($courier);

        return $this->documentForVehicle($vehicle, $kind);
    }

    public function vehicleForLogistics(User $logistics, string $courierId): Vehicle
    {
        $organization = $logistics->logisticsOrganization()->with('hub')->first();
        $courier = User::query()->whereKey($courierId)->where('role', UserRole::Courier)->first();
        if (! $organization?->hub || ! $courier || $courier->status !== UserStatus::Active) {
            throw CourierVehicleException::notFound();
        }
        $authorized = $courier->courierLogisticsAffiliation()
            ->where('logistics_organization_id', $organization->id)
            ->where('logistics_hub_id', $organization->hub->id)
            ->where('status', CourierAffiliationStatus::Approved)
            ->exists();
        if (! $authorized) {
            throw CourierVehicleException::notFound();
        }

        return $this->soleVehicle($courier);
    }

    public function documentForLogistics(User $logistics, string $courierId, string $kind): Document
    {
        return $this->documentForVehicle($this->vehicleForLogistics($logistics, $courierId), $kind);
    }

    /** @return array<string, mixed> */
    public function projection(Vehicle $vehicle, bool $logistics = false): array
    {
        $vehicle->loadMissing(['courierProfile', 'officialReceiptDocument', 'certificateOfRegistrationDocument']);
        $prefix = $logistics ? 'logistics.couriers.vehicle.documents.show' : 'courier.vehicle.documents.show';
        $routeParameters = $logistics
            ? ['courier' => $vehicle->courierProfile?->user_id, 'kind' => null]
            : ['kind' => null];

        return [
            'id' => (string) $vehicle->id,
            'vehicle_type' => $vehicle->type?->value,
            'plate_number' => $vehicle->plate_number,
            'make' => $vehicle->make,
            'model' => $vehicle->model,
            'revision' => (int) $vehicle->revision,
            'official_receipt' => $this->documentProjection($vehicle->officialReceiptDocument, $prefix, $routeParameters, 'official_receipt'),
            'certificate_of_registration' => $this->documentProjection($vehicle->certificateOfRegistrationDocument, $prefix, $routeParameters, 'certificate_of_registration'),
        ];
    }

    private function soleVehicle(User $courier, bool $lock = false): Vehicle
    {
        $profile = $courier->courierProfile()->first();
        if (! $profile) {
            throw CourierVehicleException::notFound();
        }
        $query = $profile->vehicles();
        if ($lock) {
            $query->lockForUpdate();
        }
        $vehicles = $query->get();
        if ($vehicles->count() !== 1) {
            throw CourierVehicleException::conflict('VEHICLE_CARDINALITY_INVALID', 'This Courier must have exactly one vehicle before vehicle management can continue.');
        }

        return $vehicles->first();
    }

    private function assertRevision(Vehicle $vehicle, int $expected): void
    {
        if ((int) $vehicle->revision !== $expected) {
            throw CourierVehicleException::conflict('VEHICLE_REVISION_STALE', 'The vehicle changed since it was loaded. Refresh and retry with the latest revision.', 'expected_revision');
        }
    }

    private function assertReplay(CourierVehicleMutation $previous, string $hash): void
    {
        if (! hash_equals((string) $previous->request_hash, $hash)) {
            throw CourierVehicleException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for different vehicle details.');
        }
    }

    private function documentType(string $kind): DocumentType
    {
        return match ($kind) {
            'official_receipt' => DocumentType::OfficialReceipt,
            'certificate_of_registration' => DocumentType::CertificateOfRegistration,
            default => throw CourierVehicleException::notFound(),
        };
    }

    private function documentForVehicle(Vehicle $vehicle, string $kind): Document
    {
        $this->documentType($kind);
        $document = $kind === 'official_receipt' ? $vehicle->officialReceiptDocument : $vehicle->certificateOfRegistrationDocument;
        if (! $document || $document->user_id !== $vehicle->courierProfile?->user_id) {
            throw CourierVehicleException::notFound();
        }

        return $document;
    }

    /** @param array<string, mixed> $params */
    private function documentProjection(?Document $document, string $route, array $params, string $kind): ?array
    {
        if (! $document) {
            return null;
        }
        $params['kind'] = $kind;

        return ['id' => (string) $document->id, 'url' => route($route, $params, false)];
    }

    /** @param list<string> $changedFields */
    private function notifyAfterCommit(string $vehicleId, string $courierId, int $revision, array $changedFields): void
    {
        $this->notifications->queueVehicleUpdated($vehicleId, $courierId, $revision, $changedFields);
    }

    private function cleanupDocument(string $documentId): void
    {
        $document = Document::query()->whereKey($documentId)->first();
        if (! $document || $document->registration_application_id || Vehicle::query()->where(function ($query) use ($documentId): void {
            $query->where('official_receipt_document_id', $documentId)->orWhere('certificate_of_registration_document_id', $documentId);
        })->exists()) {
            return;
        }
        try {
            Storage::disk($document->disk)->delete($document->path);
        } catch (Throwable) {
            // Keep the metadata if remote deletion fails; a maintenance job can retry it.
            return;
        }
        $document->delete();
    }

    /** @return array{mime:string,extension:string,size:int,width:int,height:int} */
    private function inspectImage(UploadedFile $file): array
    {
        $size = (int) $file->getSize();
        $dimensions = @getimagesize($file->getRealPath());
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $mime = is_array($dimensions) ? (string) ($dimensions['mime'] ?? '') : '';
        if ($size >= 10 * 1024 * 1024 || ! isset($allowed[$mime])) {
            throw ValidationException::withMessages(['file' => ['The document must be a valid JPEG, PNG, or WebP image smaller than 10 MB.']]);
        }
        $extension = strtolower($file->getClientOriginalExtension());
        $extension = $extension === 'jpeg' ? 'jpg' : $extension;
        if ($extension !== $allowed[$mime]) {
            throw ValidationException::withMessages(['file' => ['The document extension does not match its image type.']]);
        }

        return ['mime' => $mime, 'extension' => $allowed[$mime], 'size' => $size, 'width' => (int) $dimensions[0], 'height' => (int) $dimensions[1]];
    }

    /** @param array<string, mixed> $payload */
    private function hash(array $payload): string
    {
        ksort($payload);

        return hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR));
    }
}
