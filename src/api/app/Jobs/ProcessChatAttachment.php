<?php

namespace App\Jobs;

use App\Enums\ChatAttachmentState;
use App\Models\ChatAttachment;
use App\Services\Messaging\Media\ChatAttachmentProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessChatAttachment implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 180;

    public bool $failOnTimeout = true;

    public function __construct(public readonly string $attachmentId) {}

    public function backoff(): array
    {
        return [15, 60, 120];
    }

    public function handle(ChatAttachmentProcessor $processor): void
    {
        $processor->process($this->attachmentId);
    }

    public function failed(?\Throwable $exception): void
    {
        ChatAttachment::query()->whereKey($this->attachmentId)->whereNull('message_id')
            ->where('state', ChatAttachmentState::Pending->value)
            ->update(['state' => ChatAttachmentState::Failed->value, 'error_code' => 'PROCESSING_UNAVAILABLE']);
    }
}
