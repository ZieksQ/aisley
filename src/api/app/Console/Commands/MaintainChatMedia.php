<?php

namespace App\Console\Commands;

use App\Enums\ChatAttachmentState;
use App\Jobs\ProcessChatAttachment;
use App\Models\ChatAttachment;
use App\Services\Messaging\Media\ChatAttachmentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MaintainChatMedia extends Command
{
    protected $signature = 'chat:maintain-media';

    protected $description = 'Recover stalled chat media processing and remove expired unbound uploads';

    public function handle(ChatAttachmentService $media): int
    {
        // A killed worker cannot execute finally; remove only old files in our private scratch directory.
        foreach (glob(storage_path('app/private/chat-processing/media-*')) ?: [] as $path) {
            if (is_file($path) && filemtime($path) < now()->subDay()->getTimestamp()) {
                unlink($path);
            }
        }
        ChatAttachment::query()->whereNull('message_id')->where('state', '!=', ChatAttachmentState::Deleted->value)
            ->where('expires_at', '<=', now())->eachById(function (ChatAttachment $row) use ($media): void {
                DB::transaction(function () use ($row, $media): void {
                    $asset = ChatAttachment::query()->whereKey($row->id)->lockForUpdate()->first();
                    if ($asset && ! $asset->message_id && $asset->state !== ChatAttachmentState::Deleted && $asset->expires_at->isPast()) {
                        $media->deleteBytes($asset);
                    }
                });
            });
        if ($media->enabled()) {
            ChatAttachment::query()->where('state', ChatAttachmentState::Pending->value)
                ->where('updated_at', '<', now()->subMinutes(10))->where('expires_at', '>', now())
                ->eachById(function (ChatAttachment $row): void {
                    DB::transaction(function () use ($row): void {
                        $asset = ChatAttachment::query()->whereKey($row->id)->lockForUpdate()->first();
                        if (! $asset || $asset->state !== ChatAttachmentState::Pending || $asset->updated_at->gt(now()->subMinutes(10))) {
                            return;
                        }
                        if ($asset->attempts >= 3) {
                            $asset->update(['state' => ChatAttachmentState::Failed, 'error_code' => 'PROCESSING_UNAVAILABLE']);
                        } else {
                            $asset->touch();
                            ProcessChatAttachment::dispatch($asset->id)->onConnection('media')->onQueue(config('chat_media.queue'))->afterCommit();
                        }
                    });
                });
        }

        return self::SUCCESS;
    }
}
