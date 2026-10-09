<?php

namespace App\Services\Messaging\Media;

use App\Enums\ChatAttachmentState;
use App\Models\ChatAttachment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ChatAttachmentProcessor
{
    public function __construct(private readonly ChatMediaScanner $scanner, private readonly ChatMediaInspector $inspector) {}

    public function process(string $id): void
    {
        // Persist the attempt before expensive work so a killed process cannot reset its retry budget.
        $claimed = DB::transaction(function () use ($id): bool {
            $asset = ChatAttachment::query()->whereKey($id)->lockForUpdate()->first();
            if (! $asset || $asset->state !== ChatAttachmentState::Pending || $asset->message_id) {
                return false;
            }
            if ($asset->attempts >= 3) {
                $asset->update(['state' => ChatAttachmentState::Failed, 'error_code' => 'PROCESSING_UNAVAILABLE']);

                return false;
            }
            $asset->increment('attempts');

            return true;
        });
        if (! $claimed) {
            return;
        }
        $retry = DB::transaction(function () use ($id): bool {
            $asset = ChatAttachment::query()->whereKey($id)->lockForUpdate()->first();
            if (! $asset || $asset->state !== ChatAttachmentState::Pending || $asset->message_id) {
                return false;
            }
            if ($asset->expires_at->isPast()) {
                app(ChatAttachmentService::class)->deleteBytes($asset);

                return false;
            }
            $directory = storage_path('app/private/chat-processing');
            if (! is_dir($directory)) {
                mkdir($directory, 0700, true);
            }
            $temporary = tempnam($directory, 'media-');
            $preview = $temporary.'.jpg';
            try {
                $input = Storage::disk($asset->disk)->readStream($asset->path);
                if (! is_resource($input)) {
                    throw new RuntimeException('Attachment storage unavailable.');
                }
                $output = fopen($temporary, 'wb');
                try {
                    stream_copy_to_stream($input, $output);
                } finally {
                    fclose($input);
                    fclose($output);
                }
                if (! $this->scanner->scan($temporary)) {
                    $asset->update(['state' => ChatAttachmentState::Rejected, 'error_code' => 'FILE_REJECTED']);

                    return false;
                }
                $metadata = $this->inspector->inspect($temporary, strtolower(pathinfo($asset->filename, PATHINFO_EXTENSION)), $preview);
                if ($asset->kind === 'image' && filesize($temporary) >= 10 * 1024 * 1024) {
                    throw ValidationException::withMessages(['file' => 'Processed image exceeds the image limit.']);
                }
                $stream = fopen($temporary, 'rb');
                try {
                    if (! Storage::disk($asset->disk)->put($asset->path, $stream, ['visibility' => 'private'])) {
                        throw new RuntimeException('Unable to store processed media.');
                    }
                } finally {
                    fclose($stream);
                }
                if (is_file($preview)) {
                    $previewPath = $asset->path.'.preview.jpg';
                    $stream = fopen($preview, 'rb');
                    try {
                        if (! Storage::disk($asset->disk)->put($previewPath, $stream, ['visibility' => 'private'])) {
                            throw new RuntimeException('Unable to store preview.');
                        }
                    } finally {
                        fclose($stream);
                    }
                    $metadata['preview_path'] = $previewPath;
                }
                $asset->update($metadata + ['state' => ChatAttachmentState::Ready, 'error_code' => null, 'byte_size' => filesize($temporary)]);
            } catch (ValidationException) {
                $asset->update(['state' => ChatAttachmentState::Rejected, 'error_code' => 'INVALID_CONTENT']);
            } catch (\Throwable) {
                $asset->update(['state' => $asset->attempts >= 3 ? ChatAttachmentState::Failed : ChatAttachmentState::Pending,
                    'error_code' => 'PROCESSING_UNAVAILABLE']);

                return $asset->state === ChatAttachmentState::Pending;
            } finally {
                @unlink($temporary);
                @unlink($preview);
                Log::info('Chat attachment processing', ['attachment_id' => $asset->id, 'state' => $asset->state->value, 'attempts' => $asset->attempts]);
            }

            return false;
        });
        if ($retry) {
            throw new RuntimeException('Chat attachment processing will retry.');
        }
    }
}
