<?php

namespace App\Services\Admin;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HomepageAdvertisementImageService
{
    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function store(UploadedFile $file): string
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
        if (! Storage::disk('public')->put($path, $bytes)) {
            throw ValidationException::withMessages(['image' => 'The image could not be stored.']);
        }

        $url = Storage::disk('public')->url($path);

        return str_starts_with($url, '/') ? url($url) : $url;
    }
}
