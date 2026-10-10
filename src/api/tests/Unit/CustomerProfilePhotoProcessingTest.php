<?php

namespace Tests\Unit;

use App\Services\Customer\ProfilePhoto\ImageRewriter;
use App\Services\Customer\ProfilePhoto\PhotoProcessor;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Symfony\Component\Process\Process;
use Tests\Support\ProfilePhotoFixtures;
use Tests\TestCase;

class CustomerProfilePhotoProcessingTest extends TestCase
{
    #[DataProvider('dimensionLimits')]
    public function test_valid_images_at_the_dimension_limits_are_rewritten(int $width, int $height): void
    {
        $result = app(PhotoProcessor::class)->process(UploadedFile::fake()->createWithContent('boundary.png', ProfilePhotoFixtures::solidPng($width, $height)));
        $this->assertSame($width, $result['width']);
        $this->assertSame($height, $result['height']);
        $this->assertSame(strlen($result['bytes']), $result['size']);
        $this->assertLessThan(ImageRewriter::MAX_BYTES, $result['size']);
        $this->assertSame([], glob(storage_path('app/private/customer-photo-processing/*')));
    }

    public static function dimensionLimits(): array
    {
        return [[8000, 1], [1, 8000], [8000, 5000]];
    }

    public function test_corrupt_header_only_image_is_rejected_even_without_form_request(): void
    {
        $this->expectException(ValidationException::class);
        app(PhotoProcessor::class)->process(UploadedFile::fake()->createWithContent('corrupt.png', ProfilePhotoFixtures::pngHeader()));
    }

    public function test_actual_size_is_checked_even_when_uploaded_file_metadata_lies(): void
    {
        $bytes = ProfilePhotoFixtures::image('png');
        $file = UploadedFile::fake()->createWithContent('oversize.png', $bytes.str_repeat("\0", ImageRewriter::MAX_BYTES - strlen($bytes)));
        $file->size(1);
        $this->expectException(ValidationException::class);
        app(PhotoProcessor::class)->process($file);
    }

    public function test_decoder_warnings_are_rejected_and_previous_error_handler_is_restored(): void
    {
        $jpeg = ProfilePhotoFixtures::image('jpg');
        $truncated = substr($jpeg, 0, -20)."\xff\xd9";
        $warning = false;
        set_error_handler(function () use (&$warning): bool {
            $warning = true;

            return true;
        });
        try {
            $partial = imagecreatefromstring($truncated);
        } finally {
            restore_error_handler();
        }
        unset($partial);
        $this->assertTrue($warning, 'Fixture must exercise GD warning handling.');

        $restored = false;
        set_error_handler(function () use (&$restored): bool {
            $restored = true;

            return true;
        });
        try {
            try {
                (new ImageRewriter)->rewrite($truncated);
                $this->fail('Decoder warning was accepted.');
            } catch (RuntimeException) {
                trigger_error('Check restored handler.', E_USER_WARNING);
                $this->assertTrue($restored);
            }
        } finally {
            restore_error_handler();
        }
    }

    public function test_oversize_rewritten_output_is_rejected_and_staging_is_cleaned(): void
    {
        // Substitute only the worker result to exercise the parent output bound.
        $processor = new class extends PhotoProcessor
        {
            protected function rewriterProcess(string $input, string $output): Process
            {
                $bytes = ProfilePhotoFixtures::image('png');
                file_put_contents($output, $bytes.str_repeat("\0", ImageRewriter::MAX_BYTES - strlen($bytes)));

                return new Process([PHP_BINARY, '-r', 'exit(0);']);
            }
        };
        try {
            $processor->process(UploadedFile::fake()->createWithContent('valid.png', ProfilePhotoFixtures::image('png')));
            $this->fail('Oversized output was accepted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('photo', $exception->errors());
            $this->assertSame([], glob(storage_path('app/private/customer-photo-processing/*')));
        }
    }
}
