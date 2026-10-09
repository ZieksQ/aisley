<?php

namespace App\Services\Messaging\Media;

use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class ChatMediaInspector
{
    public const MIME = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp',
        'mp4' => 'video/mp4', 'pdf' => 'application/pdf', 'txt' => 'text/plain', 'csv' => 'text/csv',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'odt' => 'application/vnd.oasis.opendocument.text', 'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
        'odp' => 'application/vnd.oasis.opendocument.presentation',
    ];

    public function available(): bool
    {
        foreach (['ffprobe', 'ffmpeg'] as $tool) {
            $process = new Process([config('chat_media.'.$tool), '-version']);
            $process->setTimeout(5);
            try {
                if ($process->run() !== 0) {
                    return false;
                }
            } catch (\Throwable) {
                return false;
            }
            if (! $process->isSuccessful()) {
                return false;
            }
        }

        return extension_loaded('gd') && extension_loaded('zip');
    }

    public function inspect(string $path, string $extension, string $previewPath): array
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        $kind = str_starts_with(self::MIME[$extension], 'image/') ? 'image' : ($extension === 'mp4' ? 'video' : 'document');
        if ($kind === 'image') {
            $this->require($mime === self::MIME[$extension]);
            $dimensions = @getimagesize($path);
            $this->require($dimensions !== false && $dimensions[0] > 0 && $dimensions[1] > 0
                && max($dimensions[0], $dimensions[1]) <= config('chat_media.max_image_edge')
                && config('chat_media.max_image_pixels') >= $dimensions[0] * $dimensions[1]);
            $image = @imagecreatefromstring(file_get_contents($path));
            $this->require($image !== false);
            try {
                $write = match ($mime) {
                    'image/jpeg' => imagejpeg($image, $path, 90),
                    'image/png' => imagepng($image, $path),
                    'image/webp' => imagewebp($image, $path, 90),
                };
                $this->require($write);
                $ratio = min(1, 640 / max($dimensions[0], $dimensions[1]));
                $thumb = imagescale($image, max(1, (int) ($dimensions[0] * $ratio)), max(1, (int) ($dimensions[1] * $ratio)));
                try {
                    $this->require(imagejpeg($thumb, $previewPath, 85));
                } finally {
                    imagedestroy($thumb);
                }
            } finally {
                imagedestroy($image);
            }

            return ['width' => $dimensions[0], 'height' => $dimensions[1]];
        }
        if ($kind === 'document') {
            app(ChatDocumentInspector::class)->inspect($path, $extension, $mime);

            return [];
        }
        $this->require($mime === 'video/mp4');
        $probe = new Process([config('chat_media.ffprobe'), '-v', 'error', '-protocol_whitelist', 'file,pipe',
            '-show_streams', '-show_format', '-of', 'json', $path]);
        $probe->setTimeout(20);
        $this->require($probe->run() === 0);
        $data = json_decode($probe->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        $streams = $data['streams'] ?? [];
        $videos = array_values(array_filter($streams, fn ($stream) => $stream['codec_type'] === 'video'));
        $duration = (float) ($data['format']['duration'] ?? 0);
        $this->require(count($videos) === 1 && $videos[0]['codec_name'] === 'h264'
            && is_finite($duration) && $duration > 0 && $duration <= 180
            && ($videos[0]['width'] ?? 0) > 0 && ($videos[0]['height'] ?? 0) > 0
            && max($videos[0]['width'], $videos[0]['height']) <= 8192);
        foreach ($streams as $stream) {
            $this->require($stream['codec_type'] === 'video'
                || ($stream['codec_type'] === 'audio' && $stream['codec_name'] === 'aac'));
        }
        $poster = new Process([config('chat_media.ffmpeg'), '-v', 'error', '-nostdin', '-protocol_whitelist', 'file,pipe',
            '-i', $path, '-frames:v', '1', '-vf', 'scale=640:640:force_original_aspect_ratio=decrease', '-y', $previewPath]);
        $poster->setTimeout(30);
        $this->require($poster->run() === 0);

        return ['width' => $videos[0]['width'], 'height' => $videos[0]['height'], 'duration_seconds' => $duration];
    }

    private function require(bool $condition): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['file' => 'This media is malformed, too large to process, or uses an unsupported format/codec.']);
        }
    }
}
