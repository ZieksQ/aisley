<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Throwable;

class MediaUrl
{
    public static function from(?string $disk, ?string $path): ?string
    {
        if (! is_string($path) || trim($path) === '') {
            return null;
        }

        $path = trim($path);

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            $scheme = parse_url($path, PHP_URL_SCHEME);

            return in_array($scheme, ['http', 'https'], true) ? $path : null;
        }

        try {
            return Storage::disk($disk ?: 'public')->url($path);
        } catch (Throwable) {
            return null;
        }
    }
}
