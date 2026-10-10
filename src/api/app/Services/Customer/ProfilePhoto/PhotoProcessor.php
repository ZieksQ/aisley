<?php

namespace App\Services\Customer\ProfilePhoto;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\Process\Exception\ExceptionInterface;
use Symfony\Component\Process\PhpExecutableFinder;
use Symfony\Component\Process\Process;
use Throwable;

class PhotoProcessor
{
    /** @return array{mime: string, extension: string, size: int, width: int, height: int, bytes: string} */
    public function process(UploadedFile $photo): array
    {
        $input = null;
        $output = null;
        try {
            $stream = fopen($photo->getRealPath(), 'rb');
            if ($stream === false) {
                throw new RuntimeException('The profile photo could not be read.');
            }
            try {
                $bytes = stream_get_contents($stream, ImageRewriter::MAX_BYTES);
            } finally {
                fclose($stream);
            }
            if (! is_string($bytes)) {
                throw new RuntimeException('The profile photo could not be read.');
            }
            $rewriter = new ImageRewriter;
            $metadata = $rewriter->inspect($bytes);
            $name = basename(str_replace('\\', '/', $photo->getClientOriginalName()));
            $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $extension = $extension === 'jpeg' ? 'jpg' : $extension;
            if (substr_count($name, '.') !== 1 || $extension !== $metadata['extension']) {
                throw new RuntimeException('The profile photo must have one extension matching its image type.');
            }

            $directory = storage_path('app/private/customer-photo-processing');
            if (! is_dir($directory) && ! mkdir($directory, 0700, true) && ! is_dir($directory)) {
                throw new RuntimeException('Image processing is unavailable.');
            }
            $input = tempnam($directory, 'source-');
            $output = tempnam($directory, 'rewritten-');
            if ($input === false || $output === false || file_put_contents($input, $bytes) !== strlen($bytes)) {
                throw new RuntimeException('Image processing is unavailable.');
            }
            unset($bytes);

            $process = $this->rewriterProcess($input, $output);
            $process->disableOutput();
            $process->setTimeout(15);
            $process->mustRun();
            $bytes = file_get_contents($output, false, null, 0, ImageRewriter::MAX_BYTES);
            if (! is_string($bytes)) {
                throw new RuntimeException('The profile photo could not be safely rewritten.');
            }
            $verified = $rewriter->inspect($bytes);
            if ($verified['mime'] !== $metadata['mime'] || $verified['width'] !== $metadata['width'] || $verified['height'] !== $metadata['height']) {
                throw new RuntimeException('The rewritten profile photo is invalid.');
            }

            return [...$verified, 'bytes' => $bytes];
        } catch (Throwable $exception) {
            $message = $exception instanceof RuntimeException && ! $exception instanceof ExceptionInterface
                ? $exception->getMessage()
                : 'The profile photo could not be processed. Please choose a valid JPEG, PNG, or WebP image.';
            throw ValidationException::withMessages(['photo' => $message]);
        } finally {
            foreach ([$input, $output] as $path) {
                if (is_string($path) && is_file($path)) {
                    unlink($path);
                }
            }
        }
    }

    protected function rewriterProcess(string $input, string $output): Process
    {
        $php = (new PhpExecutableFinder)->find(false);
        if ($php === false) {
            throw new RuntimeException('Image processing is unavailable.');
        }

        return new Process([
            $php, '-d', 'memory_limit=512M', '-d', 'max_execution_time=15',
            app_path('Services/Customer/ProfilePhoto/rewrite.php'), $input, $output,
        ], base_path());
    }
}
