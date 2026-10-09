<?php

namespace Tests\Feature\Messaging;

use App\Services\Messaging\Media\ChatMediaScanner;
use Tests\TestCase;

class LiveChatMediaScannerTest extends TestCase
{
    public function test_real_clamav_stream_accepts_clean_content_and_rejects_eicar(): void
    {
        if (getenv('CHAT_MEDIA_LIVE_SCANNER') !== '1') {
            $this->markTestSkipped('Enable explicitly against the isolated local ClamAV service.');
        }
        config(['chat_media.clamav_host' => '127.0.0.1', 'chat_media.clamav_port' => 13310]);
        $scanner = app(ChatMediaScanner::class);
        $this->assertTrue($scanner->available());
        $directory = storage_path('framework/testing');
        if (! is_dir($directory)) {
            mkdir($directory, 0700, true);
        }
        $file = tempnam($directory, 'scanner-');
        try {
            file_put_contents($file, 'A clean delivery instruction.');
            $this->assertTrue($scanner->scan($file));
            // Standard harmless antivirus test string, never executable application code.
            file_put_contents($file, base64_decode('WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo='));
            $this->assertFalse($scanner->scan($file));
        } finally {
            unlink($file);
        }
    }
}
