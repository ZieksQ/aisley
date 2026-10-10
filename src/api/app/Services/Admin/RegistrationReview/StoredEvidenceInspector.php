<?php

namespace App\Services\Admin\RegistrationReview;

use App\Models\Document;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class StoredEvidenceInspector
{
    private const MAX_BYTES = 10 * 1024 * 1024;

    private const MAX_EDGE = 8000;

    private const MAX_PIXELS = 40000000;

    private const EXTENSIONS = ['image/jpeg' => ['jpg', 'jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp']];

    public function validate(Document $document, string $field): void
    {
        $bytes = $this->read($document, $field);
        $size = strlen($bytes);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $extensions = self::EXTENSIONS[$mime] ?? [];
        $pathExtension = strtolower(pathinfo($document->path, PATHINFO_EXTENSION));
        $originalName = basename(str_replace('\\', '/', $document->original_name));
        $originalExtension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

        if ($size === 0 || $size >= self::MAX_BYTES || $size !== $document->size_bytes
            || $mime !== $document->mime_type || ! in_array($pathExtension, $extensions, true)
            || ! in_array($originalExtension, $extensions, true)
            || substr_count($originalName, '.') !== 1
            || ($mime === 'image/jpeg' && ! str_ends_with($bytes, "\xff\xd9"))
            || ($mime === 'image/webp' && (strlen($bytes) < 12 || unpack('V', substr($bytes, 4, 4))[1] + 8 !== $size))
            || ($document->checksum !== null && ! hash_equals($document->checksum, hash('sha256', $bytes)))) {
            $this->invalid($field);
        }

        $metadata = @getimagesizefromstring($bytes);
        if ($metadata === false || ($metadata['mime'] ?? null) !== $mime
            || $metadata[0] < 1 || $metadata[1] < 1
            || $metadata[0] > self::MAX_EDGE || $metadata[1] > self::MAX_EDGE || $metadata[0] * $metadata[1] > self::MAX_PIXELS) {
            $this->invalid($field);
        }

        // Reject decoder warnings as well as failures: GD can return a partial
        // image for a truncated JPEG. Never rewrite private review originals.
        $warning = false;
        $image = false;
        set_error_handler(function () use (&$warning): bool {
            $warning = true;

            return true;
        });
        try {
            $image = imagecreatefromstring($bytes);
        } catch (Throwable) {
            $warning = true;
        } finally {
            restore_error_handler();
        }

        if ($image !== false) {
            imagedestroy($image);
        }
        if ($warning || $image === false) {
            $this->invalid($field);
        }
    }

    private function read(Document $document, string $field): string
    {
        $stream = null;
        try {
            $diskConfig = config('filesystems.disks.'.$document->disk);
            if (! is_array($diskConfig) || $document->disk === 'public'
                || ($diskConfig['visibility'] ?? null) === 'public'
                || $document->path === '' || str_starts_with($document->path, '/')
                || str_contains($document->path, '\\') || str_contains($document->path, ':')
                || in_array('..', explode('/', $document->path), true)) {
                $this->invalid($field);
            }

            $stream = Storage::disk($document->disk)->readStream($document->path);
            if (! is_resource($stream)) {
                $this->invalid($field);
            }
            $bytes = stream_get_contents($stream, self::MAX_BYTES);
            if (! is_string($bytes) || ! feof($stream)) {
                $this->invalid($field);
            }

            return $bytes;
        } catch (Throwable) {
            $this->invalid($field);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    private function invalid(string $field): never
    {
        throw ValidationException::withMessages([
            $field => 'The stored evidence is unavailable or invalid. Approval requires a valid private JPEG, PNG, or WebP image under 10 MB, at most 8,000 pixels per edge and 40 megapixels.',
        ]);
    }
}
