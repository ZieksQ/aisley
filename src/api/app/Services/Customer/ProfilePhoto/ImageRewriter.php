<?php

namespace App\Services\Customer\ProfilePhoto;

use GdImage;
use RuntimeException;
use Throwable;

class ImageRewriter
{
    public const MAX_BYTES = 10 * 1024 * 1024;

    public const MAX_EDGE = 8000;

    public const MAX_PIXELS = 40_000_000;

    public const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    /** @return array{mime: string, extension: string, size: int, width: int, height: int} */
    public function inspect(string $bytes): array
    {
        $size = strlen($bytes);
        if ($size === 0 || $size >= self::MAX_BYTES) {
            throw new RuntimeException('The profile photo must be smaller than 10 MiB.');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $dimensions = @getimagesizefromstring($bytes);
        if (! isset(self::EXTENSIONS[$mime]) || $dimensions === false || ($dimensions['mime'] ?? null) !== $mime) {
            throw new RuntimeException('The profile photo must be a valid JPEG, PNG, or WebP image.');
        }

        $width = (int) $dimensions[0];
        $height = (int) $dimensions[1];
        if ($width < 1 || $height < 1 || $width > self::MAX_EDGE || $height > self::MAX_EDGE
            || $width * $height > self::MAX_PIXELS) {
            throw new RuntimeException('The profile photo must be at most 8,000 pixels per edge and 40 megapixels.');
        }

        return ['mime' => $mime, 'extension' => self::EXTENSIONS[$mime], 'size' => $size, 'width' => $width, 'height' => $height];
    }

    public function rewrite(string $bytes): string
    {
        $metadata = $this->inspect($bytes);
        $this->validateContainer($bytes, $metadata['mime']);
        $source = $this->decode($bytes);
        try {
            if (imagesx($source) !== $metadata['width'] || imagesy($source) !== $metadata['height']) {
                throw new RuntimeException('The profile photo dimensions are invalid.');
            }

            imagesavealpha($source, true);
            $level = ob_get_level();
            ob_start();
            try {
                $this->strict(function () use ($source, $metadata): bool {
                    return match ($metadata['mime']) {
                        'image/jpeg' => imagejpeg($source, null, 90),
                        'image/png' => imagepng($source, null, 6),
                        'image/webp' => imagewebp($source, null, 90),
                    };
                });
                $rewritten = ob_get_contents();
            } finally {
                while (ob_get_level() > $level) {
                    ob_end_clean();
                }
            }
        } finally {
            unset($source);
        }

        if (! is_string($rewritten) || $rewritten === '') {
            throw new RuntimeException('The profile photo could not be safely rewritten.');
        }
        $output = $this->inspect($rewritten);
        if ($output['mime'] !== $metadata['mime'] || $output['width'] !== $metadata['width'] || $output['height'] !== $metadata['height']) {
            throw new RuntimeException('The rewritten profile photo is invalid.');
        }
        $this->validateContainer($rewritten, $output['mime']);
        $verified = $this->decode($rewritten);
        unset($verified);

        return $rewritten;
    }

    private function decode(string $bytes): GdImage
    {
        if (! function_exists('imagecreatefromstring')) {
            throw new RuntimeException('Image processing is unavailable.');
        }

        return $this->strict(fn () => imagecreatefromstring($bytes));
    }

    /** Reject warnings too: GD can return a partial image for a truncated JPEG. */
    private function strict(callable $operation): mixed
    {
        $warning = false;
        $result = false;
        set_error_handler(function () use (&$warning): bool {
            $warning = true;

            return true;
        });
        try {
            $result = $operation();
        } catch (Throwable) {
            $warning = true;
        } finally {
            restore_error_handler();
        }

        if ($warning || $result === false) {
            if ($result instanceof GdImage) {
                unset($result);
            }
            throw new RuntimeException('The profile photo could not be decoded or safely rewritten.');
        }

        return $result;
    }

    private function validateContainer(string $bytes, string $mime): void
    {
        if ($mime === 'image/jpeg' && str_ends_with($bytes, "\xff\xd9")) {
            return;
        }
        if ($mime === 'image/webp' && strlen($bytes) >= 12
            && unpack('V', substr($bytes, 4, 4))[1] + 8 === strlen($bytes)) {
            return;
        }
        if ($mime === 'image/png') {
            // Require complete chunks and IEND, even when GD tolerates missing
            // terminal data. Harmless trailing bytes are removed by rewriting.
            $offset = 8;
            $size = strlen($bytes);
            while ($offset + 12 <= $size) {
                $length = unpack('N', substr($bytes, $offset, 4))[1];
                if ($length > $size - $offset - 12) {
                    break;
                }
                $type = substr($bytes, $offset + 4, 4);
                $chunk = substr($bytes, $offset + 4, $length + 4);
                if (! hash_equals(hash('crc32b', $chunk, true), substr($bytes, $offset + 8 + $length, 4))) {
                    break;
                }
                if ($type === 'IEND' && $length === 0) {
                    return;
                }
                $offset += $length + 12;
            }
        }

        throw new RuntimeException('The profile photo contains incomplete or corrupt image data.');
    }
}
