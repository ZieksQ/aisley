<?php

namespace Tests\Unit;

use App\Services\Messaging\Media\ChatMediaInspector;
use Dompdf\Dompdf;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;
use Tests\TestCase;
use ZipArchive;

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
        foreach (['jpg', 'png', 'webp'] as $extension) {
            $path = $this->path();
            $image = imagecreatetruecolor(40, 20);
            match ($extension) {
                'jpg' => imagejpeg($image, $path),
                'png' => imagepng($image, $path),
                'webp' => imagewebp($image, $path),
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

    public function test_plain_documents_and_real_pdf_are_accepted_but_unsafe_content_is_not(): void
    {
        foreach (['txt' => "Delivery instructions\nKeep dry.", 'csv' => "item,quantity\nBox,2\n"] as $extension => $bytes) {
            $path = $this->path();
            file_put_contents($path, $bytes);
            $this->assertSame([], app(ChatMediaInspector::class)->inspect($path, $extension, $path.'.jpg'));
        }
        $pdf = new Dompdf;
        $pdf->loadHtml('<p>Invoice details</p>');
        $pdf->render();
        $path = $this->path();
        file_put_contents($path, $pdf->output());
        $this->assertSame([], app(ChatMediaInspector::class)->inspect($path, 'pdf', $path.'.jpg'));
        file_put_contents($path, $pdf->output()."\n/Encrypt 1 0 R\n");
        $this->reject($path, 'pdf');
        file_put_contents($path, preg_replace('/^%PDF-1\.[0-9]/', '%PDF-2.0', $pdf->output()));
        $this->assertSame([], app(ChatMediaInspector::class)->inspect($path, 'pdf', $path.'.jpg'));
        file_put_contents($path, "%PDF-1.7\nstartxref\n0\n%%EOF");
        $this->reject($path, 'pdf');
        file_put_contents($path, preg_replace('/startxref\s+\d+/', 'startxref 999999999', $pdf->output()));
        $this->reject($path, 'pdf');
        file_put_contents($path, "Not a PDF\0binary");
        $this->reject($path, 'pdf');
        $this->reject($path, 'txt');
    }

    public function test_packaged_documents_validate_internal_format_and_block_macros_and_bombs(): void
    {
        $parts = ['docx' => ['word/document.xml', 'wordprocessingml.document.main+xml'],
            'xlsx' => ['xl/workbook.xml', 'spreadsheetml.sheet.main+xml'],
            'pptx' => ['ppt/presentation.xml', 'presentationml.presentation.main+xml']];
        foreach ($parts as $extension => [$part, $type]) {
            $path = $this->archive(['[Content_Types].xml' => '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.'.$type.'" /></Types>', $part => '<document />']);
            $this->assertSame([], app(ChatMediaInspector::class)->inspect($path, $extension, $path.'.jpg'));
        }
        foreach (['odt' => 'text', 'ods' => 'spreadsheet', 'odp' => 'presentation'] as $extension => $type) {
            $path = $this->archive(['mimetype' => 'application/vnd.oasis.opendocument.'.$type, 'content.xml' => '<document />']);
            $this->assertSame([], app(ChatMediaInspector::class)->inspect($path, $extension, $path.'.jpg'));
        }
        $base = ['[Content_Types].xml' => '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" /></Types>', 'word/document.xml' => '<document />'];
        $this->reject($this->archive($base + ['word/vbaProject.bin' => 'macro']), 'docx');
        $this->reject($this->archive($base), 'xlsx');
        $this->reject($this->archive($base + ['../escape.txt' => 'path']), 'docx');
        $this->reject($this->archive(array_replace($base, ['word/document.xml' => '<!DOCTYPE doc [<!ENTITY x "value">]><doc>&x;</doc>'])), 'docx');
        config(['chat_media.max_archive_bytes' => 128]);
        $this->reject($this->archive($base + ['huge.txt' => str_repeat('x', 1024)]), 'docx');
    }

    public function test_real_mp4_metadata_poster_and_incompatible_codecs(): void
    {
        if (! app(ChatMediaInspector::class)->available()) {
            $this->markTestSkipped('Requires approved ffmpeg/ffprobe runtime tools.');
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

    private function archive(array $entries): string
    {
        $path = $this->path();
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        foreach ($entries as $name => $bytes) {
            $zip->addFromString($name, $bytes);
        }
        $zip->close();

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
