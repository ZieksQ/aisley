<?php

namespace App\Services\Admin;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HomepageAdvertisementImageService
{
    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    /**
     * @return array{path: string, filename: string}
     */
    public function store(UploadedFile $file): array
    {
        if (($file->getSize() ?? 0) >= 10_485_760) {
            throw ValidationException::withMessages(['image' => 'The image must be smaller than 10 MiB.']);
        }
        if (substr_count($file->getClientOriginalName(), '.') !== 1) {
            throw ValidationException::withMessages(['image' => 'The image filename must have one valid extension.']);
        }
        $dimensions = @getimagesize($file->getRealPath());
        $mime = $dimensions['mime'] ?? null;
        $extension = self::EXTENSIONS[$mime] ?? null;
        $width = (int) ($dimensions[0] ?? 0);
        $height = (int) ($dimensions[1] ?? 0);
        if ($width < 1 || $height < 1 || $width > 8000 || $height > 8000 || $width * $height > 40_000_000) {
            throw ValidationException::withMessages(['image' => 'The image exceeds the 8,000-pixel edge or 40-megapixel limit.']);
        }
        $clientExtension = strtolower($file->getClientOriginalExtension()) === 'jpeg' ? 'jpg' : strtolower($file->getClientOriginalExtension());
        if (! $extension || $extension !== $clientExtension || ! $dimensions) {
            throw ValidationException::withMessages(['image' => 'Only valid JPEG, PNG, or WebP images are allowed.']);
        }
        $source = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($file->getRealPath()), 'image/png' => @imagecreatefrompng($file->getRealPath()), 'image/webp' => @imagecreatefromwebp($file->getRealPath())
        };
        if (! $source) {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be decoded.']);
        }
        ob_start();
        $written = match ($mime) {
            'image/jpeg' => imagejpeg($source, null, 90), 'image/png' => imagepng($source, null, 6), 'image/webp' => imagewebp($source, null, 90)
        };
        $bytes = ob_get_clean();
        imagedestroy($source);
        if (! $written || ! is_string($bytes) || $bytes === '') {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be safely rewritten.']);
        }
        $path = 'homepage-advertisements/'.Str::uuid7().'.'.$extension;
        if (! Storage::disk(self::disk())->put($path, $bytes)) {
            throw ValidationException::withMessages(['image' => 'The image could not be stored.']);
        }

        return [
            'path' => $path,
            'filename' => self::displayFilename($file->getClientOriginalName()),
        ];
    }

    public static function disk(): string
    {
        return config('filesystems.default') === 'azure' ? 'azure' : 'public';
    }

    public static function storagePath(?string $disk, ?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        $value = trim($value);
        if (! filter_var($value, FILTER_VALIDATE_URL)) {
            return ltrim($value, '/');
        }

        $applicationStorageUrl = rtrim((string) config('app.url'), '/').'/storage/';
        if (str_starts_with($value, $applicationStorageUrl)) {
            return substr($value, strlen($applicationStorageUrl));
        }

        $baseUrl = rtrim(Storage::disk($disk ?: 'public')->url(''), '/').'/';

        return str_starts_with($value, $baseUrl) ? substr($value, strlen($baseUrl)) : null;
    }

    public static function looksLikeStoredPath(mixed $value): bool
    {
        return is_string($value)
            && (bool) preg_match('#^homepage-advertisements/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$#i', $value);
    }

    public static function assertStoredPath(mixed $value, string $disk, string $attribute): string
    {
        if (! self::looksLikeStoredPath($value) || ! Storage::disk($disk)->exists($value)) {
            throw ValidationException::withMessages([$attribute => 'Insert a JPEG, PNG, or WebP image that was uploaded to advertisement storage.']);
        }

        return $value;
    }

    public static function displayFilename(string $filename): string
    {
        $filename = trim((string) preg_replace('/[[:cntrl:]]/', '', basename(str_replace('\\', '/', $filename))));

        return Str::limit($filename !== '' ? $filename : 'advertisement-image', 255, '');
    }
}
