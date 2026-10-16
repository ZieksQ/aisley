<?php

namespace Tests\Unit;

use App\Services\Messaging\Media\ChatMediaInspector;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class ChatMediaInspectionTest extends TestCase
{
    private array $temporary = [];

    protected function tearDown(): void
    {
        foreach ($this->temporary as $path) {
            @unlink($path);
            @unlink($path.'.jpg');
        }
        parent::tearDown();
    }

    public function test_allowed_images_are_decoded_rewritten_and_previewed(): void
    {
        foreach (['jpg', 'jpeg', 'png'] as $extension) {
            $path = $this->path();
            $image = imagecreatetruecolor(40, 20);
            match ($extension) {
                'jpg', 'jpeg' => imagejpeg($image, $path),
                'png' => imagepng($image, $path),
            };
            imagedestroy($image);
            $metadata = app(ChatMediaInspector::class)->inspect($path, $extension, $path.'.jpg');
            $this->assertSame(['width' => 40, 'height' => 20], $metadata);
            $this->assertFileExists($path.'.jpg');
        }
    }

    public function test_corrupt_images_spoofed_types_and_dimension_bombs_fail(): void
    {
        $fake = UploadedFile::fake()->image('photo.png', 12, 12);
        $this->reject($fake->getRealPath(), 'jpg');
        $path = $this->path();
        file_put_contents($path, "\x89PNG\r\n\x1A\n");
        $this->reject($path, 'png');
        config(['chat_media.max_image_pixels' => 100]);
        $this->reject($fake->getRealPath(), 'png');
    }

    public function test_removed_formats_and_unknown_extensions_are_rejected(): void
    {
        $path = $this->path();
        file_put_contents($path, 'Unsupported file');
        foreach (['webp', 'pdf', 'txt', 'csv', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'svg', 'gif', 'mov', 'exe'] as $extension) {
            $this->reject($path, $extension);
        }
    }

    public function test_small_vm_image_dimension_and_pixel_boundaries(): void
    {
        foreach ([[4096, 1, true], [4097, 1, false], [4000, 2000, true], [4001, 2000, false]] as [$width, $height, $accepted]) {
            $path = $this->path();
            $image = imagecreatetruecolor($width, $height);
            imagepng($image, $path);
            imagedestroy($image);
            if (! $accepted) {
                $this->reject($path, 'png');
            } else {
                $this->assertSame(['width' => $width, 'height' => $height], app(ChatMediaInspector::class)->inspect($path, 'png', $path.'.jpg'));
            }
        }
    }

    public function test_real_mp4_metadata_poster_and_incompatible_codecs(): void
    {
        foreach (['ffmpeg', 'ffprobe'] as $tool) {
            $executable = config('chat_media.'.$tool);
            if (! is_executable($executable) && (new ExecutableFinder)->find($executable) === null) {
                $this->markTestSkipped('Requires approved ffmpeg/ffprobe runtime tools.');
            }
        }
        $path = $this->video('libx264', 2);
        $metadata = app(ChatMediaInspector::class)->inspect($path, 'mp4', $path.'.jpg');
        $this->assertSame(64, $metadata['width']);
        $this->assertSame(32, $metadata['height']);
        $this->assertEqualsWithDelta(2, $metadata['duration_seconds'], 0.1);
        $this->assertFileExists($path.'.jpg');
        $this->reject($this->video('mpeg4', 1), 'mp4');
        $this->reject($this->video('libx264', 181), 'mp4');
    }

    private function path(): string
    {
        $directory = storage_path('framework/testing/chat-media');
        if (! is_dir($directory)) {
            mkdir($directory, 0700, true);
        }
        $path = tempnam($directory, 'fixture-');
        $this->temporary[] = $path;

        return $path;
    }

    private function video(string $codec, int $seconds): string
    {
        $path = $this->path();
        $process = new Process([config('chat_media.ffmpeg'), '-v', 'error', '-f', 'lavfi', '-i', 'color=size=64x32:rate=1',
            '-t', (string) $seconds, '-c:v', $codec, '-pix_fmt', 'yuv420p', '-f', 'mp4', '-y', $path]);
        $process->setTimeout(30);
        $process->mustRun();

        return $path;
    }

    private function reject(string $path, string $extension): void
    {
        try {
            app(ChatMediaInspector::class)->inspect($path, $extension, $path.'.jpg');
            $this->fail('Unsafe attachment was accepted.');
        } catch (ValidationException $error) {
            $this->assertArrayHasKey('file', $error->errors());
        }
    }
}
