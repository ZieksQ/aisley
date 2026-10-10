<?php

namespace Tests\Support;

class ProfilePhotoFixtures
{
    public static function image(string $extension, int $width = 2, int $height = 2): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 100, 150, 200, 80));
        ob_start();
        try {
            match ($extension) {
                'jpg', 'jpeg' => imagejpeg($image, null, 90),
                'png' => imagepng($image, null, 6),
                'webp' => imagewebp($image, null, 90),
            };

            return ob_get_contents();
        } finally {
            ob_end_clean();
            unset($image);
        }
    }

    public static function pngHeader(int $width = 1, int $height = 1): string
    {
        return "\x89PNG\r\n\x1a\n".self::pngChunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0));
    }

    public static function pngChunk(string $type, string $data): string
    {
        return pack('N', strlen($data)).$type.$data.hash('crc32b', $type.$data, true);
    }

    /** Build a real large solid image without allocating a GD bitmap in tests. */
    public static function solidPng(int $width, int $height): string
    {
        $compressor = deflate_init(ZLIB_ENCODING_DEFLATE);
        $row = str_repeat("\0", $width * 3 + 1);
        $compressed = '';
        for ($index = 0; $index < $height; $index++) {
            $compressed .= deflate_add($compressor, $row, ZLIB_NO_FLUSH);
        }
        $compressed .= deflate_add($compressor, '', ZLIB_FINISH);

        return self::pngHeader($width, $height).self::pngChunk('IDAT', $compressed).self::pngChunk('IEND', '');
    }

    /** @return array<string, array{string, string}> */
    public static function invalidImages(): array
    {
        $png = self::image('png');
        $jpeg = self::image('jpg');
        $webp = self::image('webp');
        $brokenWebp = substr($webp, 0, -8);
        $brokenWebp = substr_replace($brokenWebp, pack('V', strlen($brokenWebp) - 8), 4, 4);

        return [
            'audit 33-byte PNG' => ['avatar.png', self::pngHeader()],
            'PNG missing IEND' => ['avatar.png', substr($png, 0, -12)],
            'PNG truncated IDAT' => ['avatar.png', substr($png, 0, 45)],
            'PNG corrupt CRC' => ['avatar.png', substr_replace($png, "\0\0\0\0", 29, 4)],
            'PNG corrupt compressed payload' => ['avatar.png', self::pngHeader().self::pngChunk('IDAT', 'invalid zlib').self::pngChunk('IEND', '')],
            'JPEG missing EOI' => ['avatar.jpg', substr($jpeg, 0, -2)],
            'JPEG truncated with EOI' => ['avatar.jpg', substr($jpeg, 0, -20)."\xff\xd9"],
            'WebP truncated container' => ['avatar.webp', substr($webp, 0, -8)],
            'WebP corrupt payload with valid container length' => ['avatar.webp', $brokenWebp],
            'edge too wide' => ['avatar.png', self::pngHeader(8001, 1)],
            'edge too tall' => ['avatar.png', self::pngHeader(1, 8001)],
            'pixels too large' => ['avatar.png', self::pngHeader(8000, 5001)],
            'zero dimension' => ['avatar.png', self::pngHeader(0, 1)],
            'mismatched extension' => ['avatar.jpg', $png],
            'multiple extensions' => ['avatar.safe.png', $png],
            'non-image' => ['avatar.png', 'not an image'],
        ];
    }
}
