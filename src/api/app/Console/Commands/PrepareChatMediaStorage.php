<?php

namespace App\Console\Commands;

use App\Services\Messaging\Media\ChatMediaAzureStorage;
use Illuminate\Console\Command;

class PrepareChatMediaStorage extends Command
{
    protected $signature = 'chat:prepare-storage';

    protected $description = 'Create the separate private Azure chat container and verify access without changing existing containers';

    public function handle(ChatMediaAzureStorage $storage): int
    {
        try {
            $storage->prepare();
        } catch (\Throwable) {
            // Provider exceptions can contain credentials, signed URLs and request details.
            $this->error('Chat storage preparation failed. Check Azure credentials, network access, a distinct container name, private access and read/write/delete permissions. Existing container settings were not changed.');

            return self::FAILURE;
        }
        $this->info('Separate private chat container is ready; read/write/delete verified. Existing container settings were not changed.');

        return self::SUCCESS;
    }
}
