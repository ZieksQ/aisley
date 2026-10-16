<?php

namespace App\Services\Messaging\Media;

use AzureOss\Storage\Blob\BlobServiceClient;
use AzureOss\Storage\Blob\Models\BlobServiceClientOptions;
use AzureOss\Storage\Common\Middleware\ClientFactory;
use AzureOss\Storage\Common\Middleware\HttpClientOptions;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ChatMediaAzureStorage
{
    public function prepare(): void
    {
        $config = config('filesystems.disks.azure_chat');
        $name = $config['container'] ?? '';
        if (! is_string($name) || ! preg_match('/^[a-z0-9](?:[a-z0-9]|-(?!-)){1,61}[a-z0-9]$/', $name)
            || $name === config('filesystems.disks.azure.container')) {
            throw new RuntimeException('Choose a valid chat container name different from the existing Azure container.');
        }
        if (empty($config['connection_string'])) {
            throw new RuntimeException('Configure the chat or existing Azure connection string first.');
        }

        $options = new HttpClientOptions(timeout: 30, connectTimeout: 10);
        $container = BlobServiceClient::fromConnectionString(
            $config['connection_string'], new BlobServiceClientOptions($options),
        )->getContainerClient($name);
        // Creates only the chat container. Existing containers and their ACLs are never modified.
        $container->createIfNotExists();
        $client = (new ClientFactory)->create($container->uri, $container->credential, options: $options);
        $acl = $client->get($container->uri, ['query' => ['restype' => 'container', 'comp' => 'acl']]);
        if ($acl->getHeaderLine('x-ms-blob-public-access') !== '') {
            throw new RuntimeException('The chat container permits anonymous access. Make only that container private in Azure before enabling chat uploads.');
        }

        $disk = Storage::disk('azure_chat');
        $path = 'chat-media/readiness/'.Str::uuid();
        $bytes = (string) Str::uuid();
        try {
            if (! $disk->put($path, $bytes) || $disk->get($path) !== $bytes) {
                throw new RuntimeException('The private chat storage read/write check failed.');
            }
        } finally {
            if (! $disk->delete($path)) {
                throw new RuntimeException('The chat storage check could not remove its temporary probe.');
            }
        }
    }
}
