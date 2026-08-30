<?php

namespace App\Services\Seller;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\RegistrationApplication;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class RegistrationEvidenceService
{
    public function store(
        User $seller,
        RegistrationApplication $application,
        UploadedFile $file,
        DocumentType $type,
    ): Document {
        $disk = (string) config('seller.registration.evidence_disk', 'local');
        $extension = strtolower($file->extension());
        $extension = $extension === 'jpeg' ? 'jpg' : $extension;
        $objectName = Str::uuid().'.'.$extension;
        $directory = 'registration-evidence/'.$seller->id;
        $path = null;

        try {
            $path = $file->storeAs($directory, $objectName, $disk);
            if (! is_string($path) || $path === '') {
                throw new RuntimeException('The registration evidence could not be stored.');
            }

            return Document::create([
                'user_id' => $seller->id,
                'registration_application_id' => $application->id,
                'type' => $type,
                'status' => DocumentStatus::Pending,
                'disk' => $disk,
                'path' => $path,
                'original_name' => Str::limit(basename(str_replace('\\', '/', $file->getClientOriginalName())), 255, ''),
                'mime_type' => (string) $file->getMimeType(),
                'size_bytes' => (int) $file->getSize(),
                'checksum' => hash_file('sha256', $file->getRealPath()) ?: null,
            ]);
        } catch (Throwable $exception) {
            if (is_string($path) && $path !== '') {
                Storage::disk($disk)->delete($path);
            }

            throw $exception;
        }
    }
}
