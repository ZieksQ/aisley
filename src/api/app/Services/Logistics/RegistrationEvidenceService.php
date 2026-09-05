<?php

namespace App\Services\Logistics;

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
    public function store(User $user, RegistrationApplication $application, UploadedFile $file, DocumentType $type): Document
    {
        $disk = (string) config('logistics.registration.evidence_disk', 'local');
        $extension = strtolower($file->extension()) === 'jpeg' ? 'jpg' : strtolower($file->extension());
        $path = null;
        try {
            $path = $file->storeAs('registration-evidence/'.$user->id, Str::uuid().'.'.$extension, $disk);
            if (! is_string($path) || $path === '') {
                throw new RuntimeException('The registration evidence could not be stored.');
            }

            return Document::create(['user_id' => $user->id, 'registration_application_id' => $application->id, 'type' => $type, 'status' => DocumentStatus::Pending, 'disk' => $disk, 'path' => $path, 'original_name' => Str::limit(basename(str_replace('\\', '/', $file->getClientOriginalName())), 255, ''), 'mime_type' => (string) $file->getMimeType(), 'size_bytes' => (int) $file->getSize(), 'checksum' => hash_file('sha256', $file->getRealPath()) ?: null]);
        } catch (Throwable $exception) {
            if (is_string($path) && $path !== '') {
                Storage::disk($disk)->delete($path);
            }
            throw $exception;
        }
    }
}
