<?php

namespace Tests\Unit;

use App\Services\Messaging\Media\ChatMediaAzureStorage;
use RuntimeException;
use Tests\TestCase;

class ChatMediaAzureStorageTest extends TestCase
{
    public function test_preparation_rejects_the_existing_container_before_any_azure_request(): void
    {
        config(['filesystems.disks.azure_chat.container' => 'existing', 'filesystems.disks.azure.container' => 'existing']);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('different from the existing Azure container');
        app(ChatMediaAzureStorage::class)->prepare();
    }

    public function test_preparation_rejects_missing_credentials_before_any_azure_request(): void
    {
        config(['filesystems.disks.azure_chat.container' => 'chat-test', 'filesystems.disks.azure_chat.connection_string' => '']);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('connection string first');
        app(ChatMediaAzureStorage::class)->prepare();
    }

    public function test_command_reports_storage_readiness(): void
    {
        $this->mock(ChatMediaAzureStorage::class)->shouldReceive('prepare')->once();
        $this->artisan('chat:prepare-storage')->expectsOutputToContain('Separate private chat container is ready')->assertSuccessful();
    }

    public function test_command_never_prints_provider_exceptions_or_credentials(): void
    {
        $this->mock(ChatMediaAzureStorage::class)->shouldReceive('prepare')->once()
            ->andThrow(new RuntimeException('AccountKey=private-credential'));
        $this->artisan('chat:prepare-storage')->expectsOutputToContain('Chat storage preparation failed')
            ->doesntExpectOutputToContain('private-credential')->assertFailed();
    }
}
